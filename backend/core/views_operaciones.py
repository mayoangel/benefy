"""Consultas operativas del negocio y creación atómica de tarjetas."""

from datetime import date

from django.db import transaction
from django.db.models import Count, Max
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from core import access, models, permissions, serializers


class PaginacionPortal(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


def _error(codigo, detalle, http_status=status.HTTP_400_BAD_REQUEST):
    return Response({'codigo': codigo, 'detalle': detalle}, status=http_status)


def _negocio_y_alcance(request, pk):
    negocio = get_object_or_404(models.Negocio, pk=pk)
    if not permissions.puede_acceder_negocio(request.user, negocio):
        return None, None, None, _error(
            'sin_permiso', 'No tienes acceso a este negocio.',
            status.HTTP_403_FORBIDDEN,
        )
    es_dueno = (
        permissions.es_admin_sistema(request.user)
        or permissions.puede_administrar_negocio(request.user, negocio)
    )
    sucursales = None
    if not es_dueno:
        sucursales = permissions.sucursales_accesibles(request.user).filter(
            negocio=negocio, status=True,
        )
    return negocio, es_dueno, sucursales, None


def _fechas(request):
    desde = request.query_params.get('desde')
    hasta = request.query_params.get('hasta')
    try:
        desde = date.fromisoformat(desde) if desde else None
        hasta = date.fromisoformat(hasta) if hasta else None
    except ValueError:
        raise ValueError('Usa fechas ISO (YYYY-MM-DD).')
    if desde and hasta and desde > hasta:
        raise ValueError('La fecha inicial no puede ser posterior.')
    return desde, hasta


def _sucursal_filtrada(request, negocio, sucursales):
    valor = request.query_params.get('sucursal')
    if not valor:
        return None, None
    try:
        sucursal_id = int(valor)
    except (TypeError, ValueError):
        return None, _error('sucursal_invalida', 'La sucursal no es válida.')
    sucursal = get_object_or_404(
        models.Sucursal, pk=sucursal_id, negocio=negocio,
    )
    if sucursales is not None and not sucursales.filter(pk=sucursal.pk).exists():
        return None, _error(
            'sin_permiso', 'No tienes acceso a esa sucursal.',
            status.HTTP_403_FORBIDDEN,
        )
    return sucursal, None


class VisitasNegocioAPIView(APIView):
    permission_classes = [permissions.EsUsuarioBenefy]

    def get(self, request, pk):
        negocio, es_dueno, sucursales, error = _negocio_y_alcance(request, pk)
        if error:
            return error
        try:
            desde, hasta = _fechas(request)
        except ValueError as exc:
            return _error('fechas_invalidas', str(exc))
        sucursal, error = _sucursal_filtrada(request, negocio, sucursales)
        if error:
            return error

        queryset = models.RegistroActividad.objects.filter(
            negocio=negocio, tipo='visita',
        ).select_related('usuario', 'sucursal')
        if not es_dueno:
            queryset = queryset.filter(sucursal__in=sucursales)
        if sucursal is not None:
            queryset = queryset.filter(sucursal=sucursal)
        if desde:
            queryset = queryset.filter(fecha_negocio__gte=desde)
        if hasta:
            queryset = queryset.filter(fecha_negocio__lte=hasta)
        estado = request.query_params.get('estado')
        if estado == 'validas':
            queryset = queryset.filter(es_valida=True)
        elif estado == 'anuladas':
            queryset = queryset.filter(es_valida=False)
        buscar = request.query_params.get('buscar', '').strip()
        if buscar:
            queryset = queryset.filter(usuario__correo__icontains=buscar)
        queryset = queryset.order_by('-fecha')

        paginador = PaginacionPortal()
        pagina = paginador.paginate_queryset(queryset, request)
        datos = serializers.RegistroActividadSerializerList(
            pagina, many=True,
        ).data
        return paginador.get_paginated_response(datos)


class CuponesNegocioAPIView(APIView):
    permission_classes = [permissions.EsUsuarioBenefy]

    def get(self, request, pk):
        negocio, es_dueno, _sucursales, error = _negocio_y_alcance(request, pk)
        if error:
            return error
        if not es_dueno:
            return _error(
                'sin_permiso', 'Solo el propietario puede consultar los cupones.',
                status.HTTP_403_FORBIDDEN,
            )
        try:
            desde, hasta = _fechas(request)
        except ValueError as exc:
            return _error('fechas_invalidas', str(exc))

        queryset = models.CuponUsuario.objects.filter(
            negocio=negocio,
        ).select_related('usuario')
        if desde:
            queryset = queryset.filter(fecha_emision__date__gte=desde)
        if hasta:
            queryset = queryset.filter(fecha_emision__date__lte=hasta)
        estado = request.query_params.get('estado')
        if estado:
            queryset = queryset.filter(status=estado)
        buscar = request.query_params.get('buscar', '').strip()
        if buscar:
            queryset = queryset.filter(usuario__correo__icontains=buscar)
        queryset = queryset.order_by('-fecha_emision')

        paginador = PaginacionPortal()
        pagina = paginador.paginate_queryset(queryset, request)
        datos = serializers.CuponUsuarioSerializerList(pagina, many=True).data
        return paginador.get_paginated_response(datos)


class CanjesNegocioAPIView(APIView):
    permission_classes = [permissions.EsUsuarioBenefy]

    def get(self, request, pk):
        negocio, es_dueno, sucursales, error = _negocio_y_alcance(request, pk)
        if error:
            return error
        try:
            desde, hasta = _fechas(request)
        except ValueError as exc:
            return _error('fechas_invalidas', str(exc))
        sucursal, error = _sucursal_filtrada(request, negocio, sucursales)
        if error:
            return error

        queryset = models.Canje.objects.filter(
            negocio=negocio,
        ).select_related('cupon', 'cupon__usuario', 'sucursal')
        if not es_dueno:
            queryset = queryset.filter(sucursal__in=sucursales)
        if sucursal is not None:
            queryset = queryset.filter(sucursal=sucursal)
        if desde:
            queryset = queryset.filter(fecha__date__gte=desde)
        if hasta:
            queryset = queryset.filter(fecha__date__lte=hasta)
        anulado = request.query_params.get('anulado')
        if anulado in ('true', '1'):
            queryset = queryset.filter(anulado=True)
        elif anulado in ('false', '0'):
            queryset = queryset.filter(anulado=False)
        buscar = request.query_params.get('buscar', '').strip()
        if buscar:
            queryset = queryset.filter(cupon__usuario__correo__icontains=buscar)
        queryset = queryset.order_by('-fecha')

        paginador = PaginacionPortal()
        pagina = paginador.paginate_queryset(queryset, request)
        datos = serializers.CanjeSerializerList(pagina, many=True).data
        return paginador.get_paginated_response(datos)


class ClientesNegocioAPIView(APIView):
    permission_classes = [permissions.EsUsuarioBenefy]

    def get(self, request, pk):
        negocio, es_dueno, _sucursales, error = _negocio_y_alcance(request, pk)
        if error:
            return error
        if not es_dueno:
            return _error(
                'sin_permiso', 'Solo el propietario puede consultar clientes.',
                status.HTTP_403_FORBIDDEN,
            )

        visitas = models.RegistroActividad.objects.filter(
            negocio=negocio, tipo='visita', es_valida=True,
        ).values('usuario').annotate(
            total=Count('id'), ultima=Max('fecha'),
        )
        saldos = {
            fila['usuario']: fila['saldo_actual']
            for fila in models.SaldoPuntos.objects.filter(
                negocio=negocio,
            ).values('usuario', 'saldo_actual')
        }
        cupones = {
            fila['usuario']: fila['total']
            for fila in models.CuponUsuario.objects.filter(
                negocio=negocio,
            ).values('usuario').annotate(total=Count('id'))
        }
        ids = set(saldos) | set(cupones)
        datos_visitas = {fila['usuario']: fila for fila in visitas}
        ids |= set(datos_visitas)
        usuarios = {
            usuario['id']: usuario
            for usuario in models.Usuario.objects.filter(
                pk__in=ids,
            ).values('id', 'nombre', 'apellido', 'correo')
        }
        buscar = request.query_params.get('buscar', '').strip().lower()
        resultados = []
        for usuario_id in ids:
            usuario = usuarios.get(usuario_id)
            if usuario is None:
                continue
            if buscar and buscar not in (
                f"{usuario['nombre']} {usuario['apellido']} {usuario['correo']}"
            ).lower():
                continue
            visita = datos_visitas.get(usuario_id)
            resultados.append({
                **usuario,
                'visitas': visita['total'] if visita else 0,
                'ultima_visita': visita['ultima'] if visita else None,
                'puntos': saldos.get(usuario_id, 0),
                'cupones': cupones.get(usuario_id, 0),
            })
        resultados.sort(key=lambda fila: fila['correo'])

        try:
            pagina = max(int(request.query_params.get('page', 1)), 1)
            tamano = min(
                max(int(request.query_params.get('page_size', 20)), 1), 100,
            )
        except (TypeError, ValueError):
            return _error('paginacion_invalida', 'La paginación no es válida.')
        inicio = (pagina - 1) * tamano
        return Response({
            'count': len(resultados),
            'page': pagina,
            'page_size': tamano,
            'results': resultados[inicio:inicio + tamano],
        })


class TarjetaCreateAPIView(APIView):
    permission_classes = [permissions.EsUsuarioBenefy]

    def post(self, request, pk):
        negocio = get_object_or_404(models.Negocio, pk=pk)
        if not permissions.puede_administrar_negocio(request.user, negocio):
            return _error(
                'sin_permiso', 'No puedes administrar este negocio.',
                status.HTTP_403_FORBIDDEN,
            )
        recompensa = request.data.get('recompensa')
        if not isinstance(recompensa, dict):
            return _error(
                'recompensa_requerida',
                'La tarjeta requiere los datos de su recompensa meta.',
            )

        datos_tarjeta = {
            'nombre': request.data.get('nombre'),
            'descripcion': request.data.get('descripcion', ''),
            'tipo': 'sellos',
            'meta': request.data.get('meta'),
            'es_repetible': request.data.get('es_repetible', False),
            'fecha_inicio': request.data.get('fecha_inicio'),
            'fecha_fin': request.data.get('fecha_fin'),
            'status': request.data.get('status', True),
            'negocio': negocio.pk,
        }
        tarjeta_serializer = serializers.DinamicaSerializerCreate(
            data=datos_tarjeta,
        )
        tarjeta_serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            access.verificar_limite_creacion(
                models.Dinamica, tarjeta_serializer.validated_data,
            )
            tarjeta = tarjeta_serializer.save()

            datos_recompensa = {
                'titulo': recompensa.get('titulo'),
                'descripcion': recompensa.get('descripcion', ''),
                'tipo': recompensa.get('tipo', 'gratis'),
                'descuento': recompensa.get('descuento'),
                'costo_desbloqueo': recompensa.get('costo_desbloqueo', 0),
                'terminos_condiciones': recompensa.get('terminos_condiciones', ''),
                'negocio': negocio.pk,
                'dinamica': tarjeta.pk,
                'es_meta': True,
                'vigencia_dias': recompensa.get('vigencia_dias', 30),
                'cantidad_disponible': recompensa.get('cantidad_disponible'),
                'status': tarjeta.status,
            }
            recompensa_serializer = serializers.RecompensaSerializerCreate(
                data=datos_recompensa,
            )
            recompensa_serializer.is_valid(raise_exception=True)
            access.verificar_limite_creacion(
                models.Recompensa, recompensa_serializer.validated_data,
            )
            recompensa = recompensa_serializer.save()

        return Response({
            'tarjeta': serializers.DinamicaSerializerDetail(tarjeta).data,
            'recompensa': serializers.RecompensaSerializerDetail(
                recompensa,
            ).data,
        }, status=status.HTTP_201_CREATED)
