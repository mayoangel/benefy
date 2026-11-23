"""API de suscripción, Checkout, Customer Portal y webhooks Stripe."""

import logging

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from core import models, permissions
from core.services import facturacion


logger = logging.getLogger('benefy.stripe')


def _negocio_administrable(request, pk):
    negocio = get_object_or_404(models.Negocio, pk=pk)
    if not permissions.puede_administrar_negocio(request.user, negocio):
        return negocio, Response(
            {
                'codigo': 'sin_permiso',
                'detalle': 'Solo el propietario puede administrar la suscripción.',
            },
            status=status.HTTP_403_FORBIDDEN,
        )
    return negocio, None


class FacturacionAPIView(APIView):
    permission_classes = [permissions.EsUsuarioBenefy]

    def get(self, request, pk):
        negocio, error = _negocio_administrable(request, pk)
        if error is not None:
            return error
        return Response(facturacion.datos_facturacion(negocio))


class CheckoutAPIView(APIView):
    permission_classes = [permissions.EsUsuarioBenefy]

    def post(self, request, pk):
        negocio, error = _negocio_administrable(request, pk)
        if error is not None:
            return error
        intervalo = str(request.data.get('intervalo', 'mensual')).strip().lower()
        sesion, reutilizada = facturacion.crear_sesion_checkout(
            negocio=negocio,
            usuario=request.user,
            intervalo=intervalo,
        )
        return Response({
            'url': sesion.url,
            'session_id': sesion.stripe_session_id,
            'reutilizada': reutilizada,
            'modo': 'test',
        })


class PortalAPIView(APIView):
    permission_classes = [permissions.EsUsuarioBenefy]

    def post(self, request, pk):
        negocio, error = _negocio_administrable(request, pk)
        if error is not None:
            return error
        sesion = facturacion.crear_sesion_portal(negocio)
        return Response({
            'url': sesion.get('url'),
            'modo': 'test',
        })


class SincronizarFacturacionAPIView(APIView):
    permission_classes = [permissions.EsUsuarioBenefy]

    def post(self, request, pk):
        negocio, error = _negocio_administrable(request, pk)
        if error is not None:
            return error
        session_id = request.data.get('session_id')
        if session_id:
            datos = facturacion.sincronizar_por_sesion(negocio, session_id)
        else:
            datos = facturacion.reconciliar_negocio(negocio)
        return Response(datos)


class StripeWebhookAPIView(APIView):
    """Endpoint público: la autenticación es la firma de Stripe."""

    authentication_classes = []
    permission_classes = []
    http_method_names = ['post', 'options']

    def post(self, request):
        firma = request.headers.get('Stripe-Signature', '')
        try:
            resultado = facturacion.procesar_webhook(request.body, firma)
        except facturacion.FirmaWebhookInvalida:
            logger.warning('stripe_webhook_rechazado motivo=firma_o_livemode')
            return Response(
                {'recibido': False, 'codigo': 'firma_invalida'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except facturacion.EventoStripeInvalido:
            logger.warning('stripe_webhook_rechazado motivo=evento_invalido')
            return Response(
                {'recibido': False, 'codigo': 'evento_invalido'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except facturacion.EventoEnProceso:
            return Response(
                {'recibido': False, 'codigo': 'evento_en_proceso'},
                status=status.HTTP_409_CONFLICT,
            )
        except (
            facturacion.StripeNoConfigurado,
            facturacion.StripeModoInvalido,
        ):
            logger.warning('stripe_webhook_rechazado motivo=configuracion')
            return Response(
                {'recibido': False, 'codigo': 'stripe_no_disponible'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except Exception:
            # Stripe reintenta ante 5xx. No se expone el error ni el payload.
            logger.warning('stripe_webhook_error_no_controlado')
            return Response(
                {'recibido': False, 'codigo': 'error_procesamiento'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return Response(resultado)
