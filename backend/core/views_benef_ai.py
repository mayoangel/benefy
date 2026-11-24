"""Proxy autenticado del portal hacia Benef AI."""

import logging
import time

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from core import models, permissions, throttling
from core.serializers_benef_ai import BenefAIChatSerializer
from core.services import benef_ai

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
