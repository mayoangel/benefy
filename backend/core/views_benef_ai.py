"""Proxy autenticado del portal hacia Benef AI y contexto analítico interno."""

import logging
import time

from django.core.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from core import models, permissions, throttling
from core.serializers_benef_ai import BenefAIChatSerializer
from core.services import benef_ai
from core.services.benef_ai_analitica import ErrorConsulta, consultar
from core.services.benef_ai_contexto import construir_contexto_benef_ai

logger = logging.getLogger('benefy.benef_ai')


def _access_token(request):
    header = request.headers.get('Authorization', '')
    scheme, _, token = header.partition(' ')
    if scheme.lower() != 'bearer' or not token.strip():
        return ''
    return token.strip()


class BenefAIChatAPIView(APIView):
    """Recibe el mensaje, valida el negocio y reenvía a Benef AI."""

    permission_classes = [permissions.EsUsuarioBenefy]
    throttle_classes = [throttling.BenefAIChatThrottle]
    http_method_names = ['post', 'options']

    def post(self, request, pk):
        negocio = get_object_or_404(
            models.Negocio.objects.only('id', 'nombre'),
            pk=pk,
            status=True,
        )
        if permissions.es_admin_sistema(request.user):
            return Response(
                {
                    'codigo': 'benef_ai_solo_negocios',
                    'detalle': 'Benef AI está disponible únicamente para usuarios de negocio.',
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        if not permissions.puede_acceder_negocio(request.user, negocio):
            return Response(
                {
                    'codigo': 'sin_acceso',
                    'detalle': 'No tienes acceso a la información de este negocio.',
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = BenefAIChatSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        sucursal = None
        if datos.get('sucursal_id') is not None:
            sucursal = get_object_or_404(
                models.Sucursal,
                pk=datos['sucursal_id'],
                negocio=negocio,
                status=True,
            )
            if not permissions.puede_acceder_sucursal(request.user, sucursal):
                return Response(
                    {
                        'codigo': 'sin_acceso',
                        'detalle': 'No tienes acceso a esa sucursal.',
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
        historial = [
            {'role': turn['role'], 'content': turn['content']}
            for turn in datos.get('history', [])
        ]
        token = _access_token(request)
        if not token:
            return Response(
                {
                    'codigo': 'sin_sesion',
                    'detalle': 'Tu sesión terminó. Inicia sesión nuevamente.',
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        inicio = time.monotonic()
        try:
            resultado = benef_ai.consultar(
                negocio_id=negocio.pk,
                mensaje=datos['message'],
                historial=historial,
                access_token=token,
                sucursal_id=sucursal.pk if sucursal is not None else None,
            )
        except benef_ai.ErrorBenefAI as exc:
            logger.warning(
                'benef_ai_chat_error usuario_id=%s negocio_id=%s codigo=%s http=%s duracion_ms=%s',
                request.user.pk,
                negocio.pk,
                exc.codigo,
                exc.status_code,
                int((time.monotonic() - inicio) * 1000),
            )
            return Response(
                {'codigo': exc.codigo, 'detalle': exc.detalle},
                status=exc.status_code,
            )

        logger.info(
            'benef_ai_chat_ok usuario_id=%s negocio_id=%s tools=%s duracion_ms=%s',
            request.user.pk,
            negocio.pk,
            ','.join(resultado['tools_used']) or '-',
            int((time.monotonic() - inicio) * 1000),
        )
        return Response({
            'answer': resultado['answer'],
            'tools_used': resultado['tools_used'],
        })


def _sucursal_id(request):
    valor = request.query_params.get('sucursal')
    if valor in (None, ''):
        return None
    try:
        return int(valor)
    except (TypeError, ValueError):
        raise ErrorConsulta('La sucursal debe ser un entero positivo.') from None


def _booleano(request, nombre):
    valor = request.query_params.get(nombre)
    if valor is None:
        return False
    return str(valor).strip().lower() in ('1', 'true', 'si', 'sí')


def _entero(request, nombre, defecto):
    valor = request.query_params.get(nombre)
    if valor in (None, ''):
        return defecto
    try:
        return int(valor)
    except (TypeError, ValueError):
        raise ErrorConsulta(f'{nombre} debe ser un entero.') from None


class BenefAIContextoAPIView(APIView):
    """Contexto confiable de identidad, plan, sucursales y tiempo."""

    permission_classes = [permissions.EsUsuarioBenefy]
    http_method_names = ['get', 'options']

    def get(self, request, pk):
        negocio = get_object_or_404(
            models.Negocio.objects.select_related('categoria'),
            pk=pk,
            status=True,
        )
        try:
            datos = construir_contexto_benef_ai(
                request.user,
                negocio,
                sucursal_id=_sucursal_id(request),
            )
        except PermissionDenied as exc:
            return Response(
                {'codigo': 'sin_acceso', 'detalle': str(exc)},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response(datos)


class BenefAIAnaliticaAPIView(APIView):
    """Analítica de solo lectura, autorizada y acotada para Benef AI."""

    permission_classes = [permissions.EsUsuarioBenefy]
    http_method_names = ['get', 'options']

    def get(self, request, pk):
        negocio = get_object_or_404(
            models.Negocio.objects.select_related('categoria'),
            pk=pk,
            status=True,
        )
        try:
            datos = consultar(
                request.user,
                negocio,
                request.query_params.get('tema', 'resumen'),
                periodo=request.query_params.get('periodo'),
                desde=request.query_params.get('desde'),
                hasta=request.query_params.get('hasta'),
                sucursal_id=_sucursal_id(request),
                comparar=_booleano(request, 'comparar'),
                orden=request.query_params.get('orden', 'visitas'),
                limite=_entero(request, 'limite', 10),
                incluir_inactivos=_booleano(request, 'incluir_inactivos'),
                estado=request.query_params.get('estado'),
            )
        except ErrorConsulta as exc:
            return Response(
                {'codigo': 'consulta_invalida', 'detalle': str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except PermissionDenied as exc:
            return Response(
                {'codigo': 'sin_permiso', 'detalle': str(exc)},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response(datos)
