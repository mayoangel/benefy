"""Finalización del registro comercial desde una identidad verificada."""

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.authentication import SupabaseIdentity
from core.services import onboarding
from core.views_portal import construir_contexto


class CompletarRegistroComercialAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        identity = request.auth
        if not isinstance(identity, SupabaseIdentity):
            return Response(
                {
                    'codigo': 'identidad_invalida',
                    'detalle': 'No se pudo verificar la identidad de Supabase.',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            resultado = onboarding.completar_registro_comercial(identity)
        except onboarding.ErrorOnboarding as exc:
            return Response(
                {'codigo': exc.codigo, 'detalle': exc.detalle},
                status=exc.status_code,
            )

        contexto = construir_contexto(resultado.usuario)
        return Response({
            'completado': True,
            'ya_existia': resultado.ya_existia,
            'usuario': contexto['usuario'],
            'negocio_id': resultado.negocio.pk,
            'contexto': contexto,
        })
