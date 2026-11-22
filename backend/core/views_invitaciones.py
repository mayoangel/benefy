"""Gestión de invitaciones a membresías comerciales."""

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core import models, permissions
from core.services import invitaciones


def _datos(invitacion):
    return {
        'token': str(invitacion.token),
        'correo': invitacion.correo,
        'rol_comercio': invitacion.rol_comercio,
        'sucursal': (
            {
                'id': invitacion.sucursal_id,
                'nombre': invitacion.sucursal.nombre,
            }
            if invitacion.sucursal_id else None
        ),
        'negocio': {
            'id': invitacion.negocio_id,
            'nombre': invitacion.negocio.nombre,
        },
        'estado': invitacion.estado,
        'creada_por_correo': invitacion.creada_por_correo,
        'motivo': invitacion.motivo,
        'fecha_creacion': invitacion.fecha_creacion,
        'fecha_expiracion': invitacion.fecha_expiracion,
        'fecha_respuesta': invitacion.fecha_respuesta,
    }


def _error(exc):
    return Response(
        {'codigo': exc.codigo, 'detalle': exc.detalle},
        status=exc.status_code,
    )


def _sucursales_supervisadas(usuario, negocio):
    return models.UsuarioNegocio.objects.filter(
        usuario=usuario,
        negocio=negocio,
        rol_comercio='supervisor',
        status=True,
    ).values('sucursal_id')


class InvitacionesNegocioAPIView(APIView):
    permission_classes = [permissions.EsUsuarioBenefy]

    def get(self, request, pk):
        negocio = get_object_or_404(models.Negocio, pk=pk)
        if not permissions.puede_acceder_negocio(request.user, negocio):
            return Response(
                {'codigo': 'sin_permiso', 'detalle': 'No tienes acceso.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        es_admin = permissions.es_admin_sistema(request.user)
        es_dueno = permissions.puede_administrar_negocio(request.user, negocio)
        if not es_admin and not es_dueno:
            sucursales = _sucursales_supervisadas(request.user, negocio)
            if not sucursales.exists():
                return Response(
                    {'codigo': 'sin_permiso', 'detalle': 'No puedes ver invitaciones.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
            queryset = models.InvitacionMembresia.objects.filter(
                negocio=negocio, sucursal_id__in=sucursales,
            )
        else:
            queryset = models.InvitacionMembresia.objects.filter(negocio=negocio)
        queryset = queryset.select_related(
            'negocio', 'sucursal',
        ).order_by('-fecha_creacion')
        return Response([_datos(invitacion) for invitacion in queryset])

    def post(self, request, pk):
        negocio = get_object_or_404(models.Negocio, pk=pk)
        rol = str(request.data.get('rol_comercio', 'empleado')).strip()
        sucursal = None
        sucursal_id = request.data.get('sucursal')
        if sucursal_id:
            sucursal = get_object_or_404(
                models.Sucursal, pk=sucursal_id, negocio=negocio,
            )

        es_admin = permissions.es_admin_sistema(request.user)
        if rol == 'dueno':
            permitido = es_admin
        else:
            permitido = permissions.puede_crear_membresia(
                request.user, negocio, sucursal, rol,
            )
        if not permitido:
            return Response(
                {
                    'codigo': 'sin_permiso',
                    'detalle': 'No puedes invitar con ese rol.',
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            invitacion = invitaciones.crear_invitacion(
                negocio=negocio,
                correo=request.data.get('correo'),
                sucursal=sucursal,
                rol_comercio=rol,
                actor=request.user,
                motivo=str(request.data.get('motivo', '')).strip(),
            )
        except invitaciones.ErrorInvitacion as exc:
            return _error(exc)
        return Response(_datos(invitacion), status=status.HTTP_201_CREATED)


class DetalleInvitacionAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, token):
        invitacion = get_object_or_404(
            models.InvitacionMembresia.objects.select_related(
                'negocio', 'sucursal',
            ),
            token=token,
        )
        identidad = request.auth
        correo = (
            request.user.correo
            if isinstance(request.user, models.Usuario)
            else getattr(identidad, 'email', '')
        )
        es_admin = permissions.es_admin_sistema(request.user)
        if not es_admin and correo.lower() != invitacion.correo.lower():
            return Response(
                {
                    'codigo': 'correo_no_coincide',
                    'detalle': 'La invitación pertenece a otro correo.',
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response(_datos(invitacion))


class AceptarInvitacionAPIView(APIView):
    permission_classes = [permissions.EsUsuarioBenefy]

    def post(self, request, token):
        try:
            membresia = invitaciones.aceptar_invitacion(
                token=token, usuario=request.user,
            )
        except invitaciones.ErrorInvitacion as exc:
            return _error(exc)
        return Response({
            'aceptada': True,
            'membresia_id': membresia.pk,
            'negocio_id': membresia.negocio_id,
            'rol_comercio': membresia.rol_comercio,
        })


class RevocarInvitacionAPIView(APIView):
    permission_classes = [permissions.EsUsuarioBenefy]

    def post(self, request, token):
        invitacion = get_object_or_404(
            models.InvitacionMembresia.objects.select_related(
                'negocio', 'sucursal',
            ),
            token=token,
        )
        permitido = permissions.es_admin_sistema(request.user) or (
            permissions.puede_administrar_negocio(
                request.user, invitacion.negocio,
            )
        )
        if (
            not permitido
            and invitacion.sucursal is not None
            and permissions.puede_administrar_operaciones_sucursal(
                request.user, invitacion.sucursal,
            )
        ):
            permitido = True
        if not permitido:
            return Response(
                {'codigo': 'sin_permiso', 'detalle': 'No puedes revocar.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            invitacion = invitaciones.revocar_invitacion(
                invitacion=invitacion,
            )
        except invitaciones.ErrorInvitacion as exc:
            return _error(exc)
        return Response(_datos(invitacion))
