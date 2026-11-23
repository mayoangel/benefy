"""Endpoints transaccionales para el flujo de alianzas entre negocios."""

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from core import models, permissions, serializers
from core.services import alianzas


def _entero(value, campo):
    try:
        return int(value)
    except (TypeError, ValueError):
        raise ValidationError({campo: 'El identificador no es válido.'}) from None


def _negocio(request):
    negocio_id = request.query_params.get('negocio')
    if not negocio_id:
        return None
    return get_object_or_404(models.Negocio, pk=_entero(negocio_id, 'negocio'))


def _contexto(request, negocio=None):
    return {
        'request': request,
        'negocio_id': negocio.pk if negocio is not None else None,
    }


class AlianzasAPIView(APIView):
    permission_classes = [permissions.EsUsuarioBenefy]

    def get(self, request):
        negocio = _negocio(request)
        vista = request.query_params.get('vista') or None
        queryset = alianzas.listar_alianzas(
            usuario=request.user, negocio=negocio, vista=vista,
        )
        return Response(serializers.AlianzaSerializerResumen(
            queryset, many=True, context=_contexto(request, negocio),
        ).data)


class DescubrirAlianzasAPIView(APIView):
    permission_classes = [permissions.EsUsuarioBenefy]

    def get(self, request):
        negocio = _negocio(request)
        if negocio is None:
            raise ValidationError({'negocio': 'Indica el negocio que busca alianzas.'})
        categoria = request.query_params.get('categoria')
        categoria_id = _entero(categoria, 'categoria') if categoria else None
        queryset = alianzas.descubrir_negocios(
            usuario=request.user,
            negocio=negocio,
            buscar=(request.query_params.get('q') or '').strip(),
            categoria=categoria_id,
        )
        return Response(serializers.NegocioAliadoSerializer(
            queryset, many=True,
        ).data)


class SolicitudAlianzaAPIView(APIView):
    permission_classes = [permissions.EsUsuarioBenefy]

    def post(self, request):
        serializer = serializers.AlianzaSolicitudSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        alianza = alianzas.crear_solicitud(
            usuario=request.user,
            negocio_origen=datos['negocio'],
            negocio_destino=datos['negocio_destino'],
            condicion_participacion=datos['condicion_participacion'],
            fecha_inicio=datos['fecha_inicio'],
            fecha_fin=datos['fecha_fin'],
        )
        return Response(
            serializers.AlianzaSerializerDetalle(
                alianza, context=_contexto(request, datos['negocio']),
            ).data,
            status=status.HTTP_201_CREATED,
        )


class DetalleAlianzaAPIView(APIView):
    permission_classes = [permissions.EsUsuarioBenefy]

    def get(self, request, pk):
        alianza = alianzas.detalle_alianza(usuario=request.user, alianza_id=pk)
        negocio = _negocio(request)
        return Response(serializers.AlianzaSerializerDetalle(
            alianza, context=_contexto(request, negocio),
        ).data)


class ResponderAlianzaAPIView(APIView):
    permission_classes = [permissions.EsUsuarioBenefy]
    accion = 'aceptar'

    def post(self, request, pk):
        alianza = alianzas.responder_solicitud(
            usuario=request.user,
            alianza_id=pk,
            aceptar=self.accion == 'aceptar',
        )
        negocio = _negocio(request)
        return Response(serializers.AlianzaSerializerDetalle(
            alianza, context=_contexto(request, negocio),
        ).data)


class FinalizarAlianzaAPIView(APIView):
    permission_classes = [permissions.EsUsuarioBenefy]

    def post(self, request, pk):
        alianza = alianzas.finalizar_alianza(
            usuario=request.user, alianza_id=pk,
        )
        negocio = _negocio(request)
        return Response(serializers.AlianzaSerializerDetalle(
            alianza, context=_contexto(request, negocio),
        ).data)


class RecompensaAlianzaAPIView(APIView):
    permission_classes = [permissions.EsUsuarioBenefy]

    def post(self, request, pk):
        alianza = alianzas.detalle_alianza(usuario=request.user, alianza_id=pk)
        negocio_id = request.data.get('negocio') or request.query_params.get('negocio')
        if not negocio_id:
            raise ValidationError({'negocio': 'Indica el negocio que ofrece el beneficio.'})
        negocio = get_object_or_404(models.Negocio, pk=_entero(negocio_id, 'negocio'))
        serializer = serializers.RecompensaAlianzaSerializerCreate(
            data=request.data,
            context={'alianza': alianza, 'negocio': negocio},
        )
        serializer.is_valid(raise_exception=True)
        recompensa = alianzas.crear_recompensa(
            usuario=request.user,
            alianza=alianza,
            negocio=negocio,
            datos=serializer.validated_data,
        )
        return Response(
            serializers.RecompensaAlianzaSerializer(recompensa).data,
            status=status.HTTP_201_CREATED,
        )
