"""Endpoints transaccionales del motor de lealtad."""

from datetime import date, timedelta

from django.conf import settings
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from core import models, permissions
from core.serializers_lealtad import (
    AdquirirCuponSerializer,
    AjustePuntosSerializer,
    CatalogoRecompensaSerializer,
    CicloTarjetaSerializer,
    CuponLealtadSerializer,
    MotivoSerializer,
    MovimientoPuntosSerializer,
    RegistrarVisitaSerializer,
    SaldoPuntosSerializer,
    VisitaResumenSerializer,
)
from core.services.lealtad import cupones, metricas, puntos, visitas
from core.services.lealtad.errores import ErrorLealtad
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


class RegistrarVisitaAPIView(APIView):
    permission_classes = [permissions.EsConsumidor]

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
    permission_classes = [permissions.EsConsumidor]

    def get(self, request):
        negocio_id = _negocio_filtro(request)
        puntos.expirar_puntos(usuario=request.user)

        saldos = models.SaldoPuntos.objects.filter(usuario=request.user)
        tarjetas = models.CicloTarjeta.objects.filter(
            usuario=request.user, estado='en_curso',
        )
        cupones = models.CuponUsuario.objects.filter(
            usuario=request.user,
            status='disponible',
            fecha_expiracion__gt=timezone.now(),
        )
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
    permission_classes = [permissions.EsConsumidor]

    def get(self, request):
        negocio_id = _negocio_filtro(request)
        visitas_qs = models.RegistroActividad.objects.filter(usuario=request.user)
        movimientos_qs = models.MovimientoPuntos.objects.filter(usuario=request.user)
        canjes_qs = models.Canje.objects.filter(cupon__usuario=request.user)
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
                    'fecha': canje.fecha,
                    'origen': canje.origen,
                    'anulado': canje.anulado,
                }
                for canje in canjes_qs.select_related('cupon')[:100]
            ],
        })


class CatalogoAPIView(APIView):
    permission_classes = [permissions.EsUsuarioBenefy]

    def get(self, request, pk):
        negocio = get_object_or_404(models.Negocio, pk=pk, status=True)
        ahora = timezone.now()
        recompensas = models.Recompensa.objects.filter(
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
                'logo_url': negocio.logo_url,
                'zona_horaria': negocio.zona_horaria,
            },
            'recompensas': CatalogoRecompensaSerializer(recompensas, many=True).data,
        })


class AdquirirCuponAPIView(APIView):
    permission_classes = [permissions.EsConsumidor]

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
    permission_classes = [permissions.EsConsumidor]

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
        return Response(metricas.metricas_negocio(negocio, desde, hasta))
