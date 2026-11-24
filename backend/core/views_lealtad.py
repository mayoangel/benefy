"""Endpoints transaccionales del motor de lealtad."""

from datetime import date, timedelta

from django.conf import settings
from django.db.models import Prefetch, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from core import models, permissions, throttling
from core.pagination import PaginacionBenefy
from core.serializers_lealtad import (
    AdquirirCuponSerializer,
    AjustePuntosSerializer,
    CatalogoRecompensaSerializer,
    CicloTarjetaSerializer,
    CuponLealtadSerializer,
    MotivoSerializer,
    MovimientoPuntosSerializer,
    NegocioDirectorioSerializer,
    NegocioQrSerializer,
    RegistrarVisitaSerializer,
    ResolverVisitaSerializer,
    SaldoPuntosSerializer,
    SucursalDirectorioSerializer,
    SucursalQrSerializer,
    VisitaResumenSerializer,
)
from core.services.lealtad import cupones, metricas, puntos, visitas
from core.services.lealtad.errores import CuentaInactiva, ErrorLealtad, NegocioInactivo
from core.utils.tiempo import fecha_negocio


def _error(exc):
    return Response(
        {'codigo': exc.codigo, 'detalle': exc.detalle},
        status=exc.http_status,
    )


def _negocio_filtro(request):
    negocio_id = request.query_params.get('negocio')
    if not negocio_id:
        return None
    try:
        return int(negocio_id)
    except (TypeError, ValueError):
        return None


class DirectorioNegociosAPIView(APIView):
    """Directorio público de negocios activos para consumidores."""

    permission_classes = [permissions.EsUsuarioBenefy]
    throttle_classes = [throttling.DirectorioThrottle]

    def get(self, request):
        negocios = models.Negocio.objects.filter(status=True).select_related(
            'categoria',
        ).prefetch_related(
            Prefetch(
                'sucursal_set',
                queryset=models.Sucursal.objects.filter(status=True).order_by('nombre'),
                to_attr='sucursales_activas',
            ),
        ).order_by('nombre', 'pk')

        buscar = (request.query_params.get('q') or '').strip()
        if buscar:
            negocios = negocios.filter(
                Q(nombre__icontains=buscar)
                | Q(descripcion__icontains=buscar)
                | Q(direccion__icontains=buscar)
                | Q(sucursal__status=True, sucursal__nombre__icontains=buscar)
                | Q(sucursal__status=True, sucursal__ciudad__icontains=buscar),
            ).distinct()

        categoria = request.query_params.get('categoria')
        if categoria:
            try:
                categoria_id = int(categoria)
            except (TypeError, ValueError):
                return Response(
                    {'codigo': 'categoria_invalida', 'detalle': 'La categoría no es válida.'},
                    status=400,
                )
            negocios = negocios.filter(categoria_id=categoria_id)

        paginador = PaginacionBenefy()
        pagina = paginador.paginate_queryset(negocios, request)
        datos = NegocioDirectorioSerializer(pagina, many=True).data
        return paginador.get_paginated_response(datos)


class ResolverVisitaAPIView(APIView):
    """Resuelve un QR sin registrar la visita, para confirmar el comercio."""

    permission_classes = [permissions.PuedeConsumir]
    throttle_classes = [throttling.VisitaResolverThrottle]

    def post(self, request):
        serializer = ResolverVisitaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not request.user.is_active:
            return _error(CuentaInactiva())
        try:
            negocio, sucursal = visitas.resolver_qr(
                serializer.validated_data['qr_uuid'],
            )
        except ErrorLealtad as exc:
            return _error(exc)
        if not negocio.status:
            return _error(NegocioInactivo('El negocio está inactivo.'))
        if sucursal is not None and not sucursal.status:
            return _error(NegocioInactivo('La sucursal está inactiva.'))
        return Response({
            'negocio': NegocioQrSerializer(negocio, context={'request': request}).data,
            'sucursal': (
                SucursalQrSerializer(sucursal).data
                if sucursal is not None else None
            ),
            'puede_registrar': True,
        })


class RegistrarVisitaAPIView(APIView):
    permission_classes = [permissions.PuedeConsumir]
    throttle_classes = [throttling.VisitaRegistrarThrottle]

    def post(self, request):
        serializer = RegistrarVisitaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            resultado = visitas.registrar_visita(
                usuario=request.user,
                qr_uuid=serializer.validated_data['qr_uuid'],
                metodo_validacion=serializer.validated_data.get('metodo_validacion', 'qr'),
            )
        except ErrorLealtad as exc:
            return _error(exc)
        cuerpo = {
            'visita': VisitaResumenSerializer(resultado['visita']).data,
            'already_registered': resultado['already_registered'],
            'puntos_otorgados': resultado['puntos_otorgados'],
            'tarjetas': resultado['tarjetas'],
            'cupones_emitidos': resultado['cupones_emitidos'],
        }
        estado = 200 if resultado['already_registered'] else 201
        return Response(cuerpo, status=estado)


class BilleteraAPIView(APIView):
    permission_classes = [permissions.PuedeConsumir]

    def get(self, request):
        negocio_id = _negocio_filtro(request)
        puntos.expirar_puntos(usuario=request.user)

        saldos = models.SaldoPuntos.objects.filter(
            usuario=request.user,
        ).select_related('negocio')
        tarjetas = models.CicloTarjeta.objects.filter(
            usuario=request.user, estado='en_curso',
        ).select_related('negocio')
        cupones = models.CuponUsuario.objects.filter(
            usuario=request.user,
            status='disponible',
            fecha_expiracion__gt=timezone.now(),
        ).select_related('negocio')
        if negocio_id is not None:
            saldos = saldos.filter(negocio_id=negocio_id)
            tarjetas = tarjetas.filter(negocio_id=negocio_id)
            cupones = cupones.filter(negocio_id=negocio_id)

        return Response({
            'saldos': SaldoPuntosSerializer(saldos, many=True).data,
            'tarjetas': CicloTarjetaSerializer(tarjetas, many=True).data,
            'cupones': CuponLealtadSerializer(cupones, many=True).data,
        })


class HistorialAPIView(APIView):
    permission_classes = [permissions.PuedeConsumir]

    def get(self, request):
        negocio_id = _negocio_filtro(request)
        visitas_qs = models.RegistroActividad.objects.filter(
            usuario=request.user,
        ).select_related('negocio', 'sucursal')
        movimientos_qs = models.MovimientoPuntos.objects.filter(
            usuario=request.user,
        ).select_related('negocio')
        canjes_qs = models.Canje.objects.filter(
            cupon__usuario=request.user,
        ).select_related('cupon', 'negocio', 'sucursal')
        if negocio_id is not None:
            visitas_qs = visitas_qs.filter(negocio_id=negocio_id)
            movimientos_qs = movimientos_qs.filter(negocio_id=negocio_id)
            canjes_qs = canjes_qs.filter(negocio_id=negocio_id)

        return Response({
            'visitas': VisitaResumenSerializer(visitas_qs[:100], many=True).data,
            'movimientos': MovimientoPuntosSerializer(movimientos_qs[:100], many=True).data,
            'canjes': [
                {
                    'id': canje.pk,
                    'cupon': str(canje.cupon.uuid),
                    'negocio': canje.negocio_id,
                    'negocio_nombre': (
                        canje.negocio.nombre if canje.negocio_id else None
                    ),
                    'negocio_slug': (
                        canje.negocio.slug if canje.negocio_id else None
                    ),
                    'negocio_logo_url': (
                        canje.negocio.logo_url if canje.negocio_id else None
                    ),
                    'sucursal': canje.sucursal_id,
                    'sucursal_nombre': (
                        canje.sucursal.nombre if canje.sucursal_id else None
                    ),
                    'fecha': canje.fecha,
                    'origen': canje.origen,
                    'anulado': canje.anulado,
                }
                for canje in canjes_qs[:100]
            ],
        })


class CatalogoAPIView(APIView):
    permission_classes = [permissions.EsUsuarioBenefy]

    def get(self, request, pk):
        negocio = get_object_or_404(
            models.Negocio.objects.select_related('categoria'),
            pk=pk,
            status=True,
        )
        ahora = timezone.now()
        recompensas = models.Recompensa.objects.select_related(
            'negocio', 'alianza',
        ).filter(
            negocio=negocio,
            status=True,
            es_meta=False,
        ).filter(
            Q(cantidad_disponible__isnull=True) | Q(cantidad_disponible__gt=0),
        ).filter(
            Q(fecha_expiracion__isnull=True) | Q(fecha_expiracion__gt=ahora),
        ).filter(
            Q(dinamica__isnull=True)
            | Q(dinamica__status=True, dinamica__fecha_inicio__lte=ahora),
        ).filter(
            Q(dinamica__isnull=True)
            | Q(dinamica__fecha_fin__isnull=True)
            | Q(dinamica__fecha_fin__gte=ahora),
        ).filter(
            Q(alianza__isnull=True)
            | Q(alianza__status='activa', alianza__fecha_fin__gte=ahora),
        ).order_by('costo_desbloqueo', 'titulo')
        return Response({
            'negocio': {
                'id': negocio.pk,
                'nombre': negocio.nombre,
                'slug': negocio.slug,
                'descripcion': negocio.descripcion,
                'direccion': negocio.direccion,
                'telefono': negocio.telefono,
                'logo_url': negocio.logo_url,
                'banner_url': negocio.banner_url,
                'categoria': {
                    'id': negocio.categoria_id,
                    'nombre': negocio.categoria.nombre,
                },
                'zona_horaria': negocio.zona_horaria,
            },
            'sucursales': SucursalDirectorioSerializer(
                negocio.sucursal_set.filter(status=True).order_by('nombre'),
                many=True,
            ).data,
            'recompensas': CatalogoRecompensaSerializer(recompensas, many=True).data,
        })


class AdquirirCuponAPIView(APIView):
    permission_classes = [permissions.PuedeConsumir]
    throttle_classes = [throttling.CuponAdquirirThrottle]

    def post(self, request):
        serializer = AdquirirCuponSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            cupon, creado = cupones.adquirir_cupon(
                usuario=request.user,
                recompensa_id=serializer.validated_data['recompensa'],
                clave_idempotencia=serializer.validated_data['clave_idempotencia'],
            )
        except models.Recompensa.DoesNotExist:
            return Response(
                {'codigo': 'recompensa_no_encontrada', 'detalle': 'La recompensa no existe.'},
                status=404,
            )
        except ErrorLealtad as exc:
            return _error(exc)
        return Response({
            'cupon': CuponLealtadSerializer(cupon).data,
            'saldo_restante': puntos.saldo_actual(
                request.user, cupon.negocio,
            ) if cupon.negocio_id else None,
        }, status=201 if creado else 200)


class CanjearCuponAPIView(APIView):
    permission_classes = [permissions.PuedeConsumir]
    throttle_classes = [throttling.CuponCanjearThrottle]

    def post(self, request, uuid):
        try:
            canje, cupon = cupones.canjear_cupon(
                usuario=request.user, cupon_uuid=uuid,
            )
        except ErrorLealtad as exc:
            return _error(exc)
        return Response({
            'canje': {
                'token_validacion': str(canje.token_validacion),
                'expira_en': canje.expira_en,
                'servidor_ahora': timezone.now(),
                'duracion_segundos': settings.CANJE_VALIDACION_SEGUNDOS,
            },
            'cupon': CuponLealtadSerializer(cupon).data,
            'negocio': {
                'id': cupon.negocio_id,
                'nombre': cupon.negocio.nombre if cupon.negocio_id else None,
                'logo_url': cupon.negocio.logo_url if cupon.negocio_id else None,
            },
        })


class AjustarPuntosAPIView(APIView):
    permission_classes = [permissions.EsAdminSistema]

    def post(self, request):
        serializer = AjustePuntosSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        usuario = get_object_or_404(models.Usuario, pk=datos['usuario'])
        negocio = get_object_or_404(models.Negocio, pk=datos['negocio'])
        try:
            movimientos = puntos.ajustar_puntos(
                usuario=usuario,
                negocio=negocio,
                cantidad=datos['cantidad'],
                motivo=datos['motivo'],
                creado_por=request.user,
                clave_idempotencia=str(datos['clave_idempotencia']),
            )
        except ValueError as exc:
            return Response(
                {'codigo': 'ajuste_invalido', 'detalle': str(exc)}, status=400,
            )
        except ErrorLealtad as exc:
            return _error(exc)
        return Response({
            'movimientos': MovimientoPuntosSerializer(movimientos, many=True).data,
            'saldo_actual': puntos.saldo_actual(usuario, negocio),
        }, status=201)


class AnularVisitaAPIView(APIView):
    permission_classes = [permissions.EsAdminSistema]

    def post(self, request, pk):
        visita = get_object_or_404(models.RegistroActividad, pk=pk)
        serializer = MotivoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            visita = visitas.anular_visita(
                visita_id=visita.pk,
                motivo=serializer.validated_data['motivo'],
                administrador=request.user,
            )
        except ValueError as exc:
            return Response(
                {'codigo': 'anulacion_invalida', 'detalle': str(exc)}, status=400,
            )
        return Response(VisitaResumenSerializer(visita).data)


class AnularCuponAPIView(APIView):
    permission_classes = [permissions.EsAdminSistema]

    def post(self, request, uuid):
        serializer = MotivoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            cupon = cupones.anular_cupon(
                cupon_uuid=uuid,
                motivo=serializer.validated_data['motivo'],
                administrador=request.user,
            )
        except ErrorLealtad as exc:
            return _error(exc)
        return Response(CuponLealtadSerializer(cupon).data)


class MetricasAPIView(APIView):
    permission_classes = [permissions.EsUsuarioBenefy]

    def get(self, request, pk):
        negocio = get_object_or_404(models.Negocio, pk=pk)
        if not permissions.puede_acceder_negocio(request.user, negocio):
            return Response(
                {'codigo': 'sin_permiso', 'detalle': 'No tienes acceso a este negocio.'},
                status=403,
            )
        hoy = fecha_negocio(negocio)
        desde = request.query_params.get('desde')
        hasta = request.query_params.get('hasta')
        try:
            desde = date.fromisoformat(desde) if desde else hoy - timedelta(days=30)
            hasta = date.fromisoformat(hasta) if hasta else hoy
        except ValueError:
            return Response(
                {'codigo': 'fechas_invalidas', 'detalle': 'Usa fechas ISO (YYYY-MM-DD).'},
                status=400,
            )
        if desde > hasta:
            return Response(
                {'codigo': 'rango_invalido', 'detalle': 'La fecha inicial no puede ser posterior.'},
                status=400,
            )

        es_admin_o_dueno = (
            permissions.es_admin_sistema(request.user)
            or permissions.puede_administrar_negocio(request.user, negocio)
        )
        if es_admin_o_dueno:
            sucursales = None
            incluir_totales = True
        else:
            sucursales = permissions.sucursales_accesibles(request.user).filter(
                negocio=negocio, status=True,
            )
            if not sucursales.exists():
                return Response(
                    {'codigo': 'sin_permiso', 'detalle': 'No tienes sucursales autorizadas.'},
                    status=403,
                )
            incluir_totales = False

        sucursal_param = request.query_params.get('sucursal')
        if sucursal_param:
            try:
                sucursal_id = int(sucursal_param)
            except (TypeError, ValueError):
                return Response(
                    {'codigo': 'sucursal_invalida', 'detalle': 'La sucursal no es válida.'},
                    status=400,
                )
            sucursal = get_object_or_404(
                models.Sucursal, pk=sucursal_id, negocio=negocio,
            )
            if not sucursal.status:
                return Response(
                    {'codigo': 'sucursal_inactiva', 'detalle': 'La sucursal está inactiva.'},
                    status=403,
                )
            if not es_admin_o_dueno and not sucursales.filter(pk=sucursal.pk).exists():
                return Response(
                    {'codigo': 'sin_permiso', 'detalle': 'No tienes acceso a esa sucursal.'},
                    status=403,
                )
            sucursales = [sucursal]
            incluir_totales = False

        return Response(metricas.metricas_negocio(
            negocio, desde, hasta,
            sucursales=sucursales,
            incluir_totales=incluir_totales,
        ))
