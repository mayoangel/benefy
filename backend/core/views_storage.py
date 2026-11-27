from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from core import models, permissions, serializers, throttling
from core.services import supabase_storage


class NegocioImagenSubidaAPIView(APIView):
    permission_classes = [permissions.EsUsuarioBenefy]
    throttle_classes = [throttling.NegocioImagenSubidaThrottle]

    def post(self, request, pk):
        negocio = get_object_or_404(models.Negocio, pk=pk)
        if not permissions.puede_administrar_negocio(request.user, negocio):
            return Response(
                {
                    'codigo': 'sin_permiso',
                    'detalle': 'Solo el propietario puede subir imágenes del negocio.',
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = serializers.SolicitudSubidaImagenNegocioSerializer(
            data=request.data,
        )
        serializer.is_valid(raise_exception=True)
        try:
            resultado = supabase_storage.crear_subida_firmada_negocio(
                negocio_id=negocio.pk,
                tipo=serializer.validated_data['tipo'],
                content_type=serializer.validated_data['content_type'],
                size_bytes=serializer.validated_data['size_bytes'],
            )
        except supabase_storage.ImagenNegocioInvalida as exc:
            return Response(
                {'codigo': 'imagen_invalida', 'detalle': exc.detalle},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except supabase_storage.ErrorSupabaseStorage as exc:
            error_status = (
                status.HTTP_502_BAD_GATEWAY
                if exc.status_code
                else status.HTTP_503_SERVICE_UNAVAILABLE
            )
            return Response(
                {'codigo': 'storage_no_disponible', 'detalle': exc.detalle},
                status=error_status,
            )

        return Response(resultado, status=status.HTTP_201_CREATED)
