"""Stripe Payments + Billing exclusivamente en Sandbox/Test Mode.

Principios de esta implementación:

- Django es la fuente del catálogo, montos y Price IDs; el navegador solo elige
  ``mensual`` o ``anual``.
- El estado de Premium se deriva de la suscripción verificada en Stripe. Un
  retorno a ``success_url`` nunca activa el plan por sí mismo.
- Los webhooks se verifican con la firma del cuerpo original y se procesan de
  forma idempotente. Antes de aplicar un cambio se consulta el objeto actual en
  Stripe para tolerar entregas duplicadas o fuera de orden.
- No se aceptan claves live ni objetos con ``livemode=true``.
"""

from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timedelta, timezone as dt_timezone
from decimal import Decimal, ROUND_HALF_UP
from urllib.parse import urlparse

import stripe
from django.conf import settings
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import APIException

from core import models
from core.services import planes


logger = logging.getLogger('benefy.stripe')


class ErrorFacturacion(APIException):
    status_code = 400
    codigo = 'facturacion_error'

    def __init__(self, detalle, codigo=None):
        super().__init__(detail={
            'codigo': codigo or self.codigo,
            'detalle': detalle,
        })


class StripeNoConfigurado(ErrorFacturacion):
    status_code = 503
    codigo = 'stripe_no_configurado'


class StripeModoInvalido(ErrorFacturacion):
    status_code = 503
    codigo = 'stripe_modo_invalido'


class ErrorStripeAPI(ErrorFacturacion):
    status_code = 502
    codigo = 'stripe_error'


class PlanNoFacturable(ErrorFacturacion):
    status_code = 409
    codigo = 'plan_no_facturable'


class PremiumYaActivo(ErrorFacturacion):
    status_code = 409
    codigo = 'premium_activo'


class SesionStripeInvalida(ErrorFacturacion):
    status_code = 400
    codigo = 'sesion_invalida'


class EventoEnProceso(ErrorFacturacion):
    status_code = 409
    codigo = 'evento_en_proceso'


class FirmaWebhookInvalida(Exception):
    """La petición no proviene de Stripe o fue alterada."""


class EventoStripeInvalido(Exception):
    """El evento no puede asociarse de forma segura a un negocio."""


def _v(obj, clave, default=None):
    """Lee un campo de un StripeObject o de un diccionario de prueba."""
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(clave, default)
    try:
        return obj.get(clave, default)
    except AttributeError:
        return getattr(obj, clave, default)


def _id(valor):
    if isinstance(valor, str):
        return valor
    if valor is None:
        return ''
    return str(_v(valor, 'id', '') or '')


def _fecha(timestamp):
    if not timestamp:
        return None
    try:
        return datetime.fromtimestamp(int(timestamp), tz=dt_timezone.utc)
    except (TypeError, ValueError, OSError):
        return None


def _lista(obj, clave):
    valor = _v(obj, clave, [])
    if isinstance(valor, dict):
        return valor.get('data', []) or []
    return list(valor or [])


def _limpiar_error(exc):
    """Evita que un mensaje de Stripe transporte claves a los logs."""
    texto = str(exc)
    texto = re.sub(
        r'\b(?:sk|rk|pk|whsec)_[A-Za-z0-9_]+',
        '[clave]',
        texto,
    )
    return texto[:300]


def _entorno_stripe(requiere_webhook=False):
    if not settings.STRIPE_ENABLED:
        raise StripeNoConfigurado(
            'Stripe Sandbox no está habilitado. Configura STRIPE_ENABLED=true.'
        )
    if settings.STRIPE_MODE != 'test':
        raise StripeModoInvalido(
            'STRIPE_MODE debe ser "test". No se permite Stripe en vivo.'
        )
    clave = (settings.STRIPE_SECRET_KEY or '').strip()
    if not clave:
        raise StripeNoConfigurado(
            'Falta STRIPE_SECRET_KEY de Sandbox. El checkout está deshabilitado.'
        )
    if clave.startswith(('sk_live_', 'rk_live_')):
        raise StripeModoInvalido('Se rechazó una clave live de Stripe.')
    if not clave.startswith(('sk_test_', 'rk_test_')):
        raise StripeModoInvalido(
            'STRIPE_SECRET_KEY no es una clave de Sandbox/Test Mode.'
        )
    if requiere_webhook:
        secreto = (settings.STRIPE_WEBHOOK_SECRET or '').strip()
        if (
            not secreto.startswith('whsec_')
            or 'REEMPLAZAR' in secreto.upper()
        ):
            raise StripeNoConfigurado(
                'Falta STRIPE_WEBHOOK_SECRET del endpoint o listener local.'
            )
    return clave


def _cliente(requiere_webhook=False):
    clave = _entorno_stripe(requiere_webhook=requiere_webhook)
    return stripe.StripeClient(clave, max_network_retries=2)


def _ejecutar(funcion, *args, **kwargs):
    try:
        return funcion(*args, **kwargs)
    except stripe.StripeError as exc:
        logger.warning(
            'stripe_api_error tipo=%s detalle=%s',
            type(exc).__name__,
            _limpiar_error(exc),
        )
        raise ErrorStripeAPI(
            'No se pudo comunicar con Stripe Sandbox. Intenta de nuevo.'
        ) from None


def verificar_modo_test(obj):
    livemode = _v(obj, 'livemode')
    if livemode is True:
        raise StripeModoInvalido(
            'Stripe devolvió un objeto en modo live. Operación rechazada.'
        )
    return obj


def _url_frontend(ruta):
    base = (settings.FRONTEND_URL or '').rstrip('/')
    partes = urlparse(base)
    if (
        partes.scheme not in ('http', 'https')
        or not partes.hostname
        or partes.username
        or partes.password
    ):
        raise StripeNoConfigurado(
            'FRONTEND_URL debe ser un origen HTTP(S) válido para los retornos.'
        )
    return f'{base}{ruta}'


def _url_checkout(negocio, resultado):
    base = _url_frontend(f'/portal/negocio/{negocio.pk}/suscripcion')
    if resultado == 'success':
        return f'{base}?checkout=success&session_id={{CHECKOUT_SESSION_ID}}'
    return f'{base}?checkout=cancel'


def _plan_premium():
    plan = models.PlanSuscripcion.objects.filter(
        codigo='premium', status=True,
    ).first()
    if plan is None:
        raise PlanNoFacturable(
            'No existe el plan premium activo. Es un error de configuración.'
        )
    return plan


def precio_catalogo(intervalo):
    if intervalo not in ('mensual', 'anual'):
        raise PlanNoFacturable('El intervalo debe ser mensual o anual.')
    precio = models.PlanPrecio.objects.filter(
        plan__codigo='premium',
        plan__status=True,
        intervalo=intervalo,
        status=True,
    ).select_related('plan').first()
    if precio is None or precio.monto is None or precio.monto <= 0:
        raise PlanNoFacturable(
            f'El precio {intervalo} del plan premium no está configurado.'
        )
    if not (precio.stripe_price_id or '').startswith('price_'):
        raise PlanNoFacturable(
            f'El precio {intervalo} del plan premium no está vinculado a un Price ID '
            'de Stripe Sandbox. Ejecuta configurar_stripe_sandbox.'
        )
    return precio


def _validar_precio_stripe(precio, cliente):
    price = verificar_modo_test(_ejecutar(
        cliente.v1.prices.retrieve, precio.stripe_price_id,
    ))
    if not _v(price, 'active', False):
        raise PlanNoFacturable('El Price de Stripe está inactivo.')
    if str(_v(price, 'currency', '')).lower() != precio.divisa.lower():
        raise PlanNoFacturable(
            'La divisa del Price de Stripe no coincide con el catálogo.'
        )
    esperado = int(
        (precio.monto * Decimal('100')).to_integral_value(
            rounding=ROUND_HALF_UP,
        )
    )
    if int(_v(price, 'unit_amount', 0) or 0) != esperado:
        raise PlanNoFacturable(
            'El monto del Price de Stripe no coincide con el catálogo de Django.'
        )
    intervalo = 'month' if precio.intervalo == 'mensual' else 'year'
    recurrente = _v(price, 'recurring', {}) or {}
    if _v(recurrente, 'interval') != intervalo:
        raise PlanNoFacturable(
            'La periodicidad del Price de Stripe no coincide con el catálogo.'
        )
    return price


def _cliente_local(negocio):
    return models.ClienteStripe.objects.filter(
        negocio=negocio, stripe_mode='test',
    ).first()


def _obtener_o_crear_cliente(negocio, cliente):
    local = _cliente_local(negocio)
    if local is not None:
        return local
    customer = verificar_modo_test(_ejecutar(
        cliente.v1.customers.create,
        {
            'name': negocio.nombre[:150],
            'email': negocio.correo,
            'description': 'Benefy Sandbox - negocio',
            'metadata': {
                'benefy_negocio_id': str(negocio.pk),
                'benefy_environment': 'sandbox',
            },
        },
        options={
            'idempotency_key': f'benefy-customer-test-{negocio.pk}',
        },
    ))
    customer_id = _id(_v(customer, 'id'))
    if not customer_id:
        raise ErrorStripeAPI('Stripe no devolvió el Customer del negocio.')
    try:
        local, _ = models.ClienteStripe.objects.get_or_create(
            negocio=negocio,
            stripe_mode='test',
            defaults={'stripe_customer_id': customer_id},
        )
    except IntegrityError:
        local = _cliente_local(negocio)
        if local is None:
            raise ErrorStripeAPI(
                'No se pudo guardar la asociación del Customer de Stripe.'
            ) from None
    return local


def _obtener_negocio_por_customer(customer_id):
    if not customer_id:
        return None
    enlace = models.ClienteStripe.objects.select_related('negocio').filter(
        stripe_customer_id=customer_id,
        stripe_mode='test',
    ).first()
    return enlace.negocio if enlace is not None else None


def _negocio_metadata(obj):
    metadata = _v(obj, 'metadata', {}) or {}
    try:
        negocio_id = int(_v(metadata, 'benefy_negocio_id', 0) or 0)
    except (TypeError, ValueError):
        return None
    if not negocio_id:
        return None
    return models.Negocio.objects.filter(pk=negocio_id).first()


def _negocio_desde_objeto(obj, negocio_esperado=None):
    """Resuelve el negocio por Customer (principal) y metadata (respaldo)."""
    customer_id = _id(_v(obj, 'customer'))
    negocio = _obtener_negocio_por_customer(customer_id)
    if negocio is None:
        negocio = _negocio_metadata(obj)
    if negocio is None:
        referencia = _v(obj, 'client_reference_id')
        if referencia:
            try:
                negocio = models.Negocio.objects.filter(pk=int(referencia)).first()
            except (TypeError, ValueError):
                negocio = None
    if negocio is None:
        raise EventoStripeInvalido(
            'El objeto de Stripe no está asociado a un negocio Benefy.'
        )
    if negocio_esperado is not None and negocio.pk != negocio_esperado.pk:
        raise SesionStripeInvalida(
            'La sesión de Stripe no pertenece a este negocio.'
        )
    return negocio


def _precio_id_suscripcion(suscripcion):
    items = _lista(suscripcion, 'items')
    if not items:
        return ''
    price = _v(items[0], 'price')
    if isinstance(price, str):
        return price
    return _id(price)


def _periodo_suscripcion(suscripcion):
    inicio = _fecha(_v(suscripcion, 'current_period_start'))
    fin = _fecha(_v(suscripcion, 'current_period_end'))
    if inicio is not None and fin is not None:
        return inicio, fin
    for item in _lista(suscripcion, 'items'):
        inicio = inicio or _fecha(_v(item, 'current_period_start'))
        fin = fin or _fecha(_v(item, 'current_period_end'))
    return inicio, fin


def _mapear_estado(stripe_status, periodo_fin):
    ahora = timezone.now()
    if stripe_status == 'active':
        return 'activa', None, True
    if stripe_status == 'trialing':
        return 'prueba', None, True
    if stripe_status == 'past_due':
        base = periodo_fin if periodo_fin and periodo_fin > ahora else ahora
        gracia = base + timedelta(days=settings.STRIPE_GRACE_DAYS)
        return 'pendiente', gracia, gracia > ahora
    if stripe_status == 'unpaid':
        return 'pendiente', None, False
    if stripe_status == 'paused':
        return 'pendiente', None, False
    if stripe_status == 'incomplete':
        return 'incompleta', None, False
    if stripe_status in ('incomplete_expired', 'canceled'):
        return 'cancelada', None, False
    return 'incompleta', None, False


def _auditar_cambio(negocio, anterior, nuevo, motivo):
    if anterior is not None and anterior.pk == nuevo.pk:
        return None
    return models.PlanCambioAuditoria.objects.create(
        negocio=negocio,
        plan_anterior=anterior,
        plan_nuevo=nuevo,
        origen='stripe',
        motivo=motivo,
        actor=None,
        actor_correo='',
    )


def _cerrar_suscripcion(suscripcion, ahora):
    suscripcion.status = 'cancelada'
    suscripcion.en_cancelacion = False
    suscripcion.gracia_fin = None
    suscripcion.fecha_fin = suscripcion.fecha_fin or ahora
    suscripcion.save(update_fields=[
        'status', 'en_cancelacion', 'gracia_fin', 'fecha_fin',
        'fecha_actualizacion',
    ])


def _asegurar_free(negocio, plan_anterior=None):
    if planes.suscripcion_actual(negocio) is not None:
        return None
    free = planes._plan_free()
    ahora = timezone.now()
    suscripcion = models.Suscripcion.objects.create(
        negocio=negocio,
        plan=free,
        status='activa',
        origen='automatico',
        fecha_inicio=ahora,
    )
    _auditar_cambio(
        negocio,
        plan_anterior if plan_anterior and plan_anterior.pk != free.pk else None,
        free,
        'Downgrade automático a Free al terminar el acceso Premium de Stripe.',
    )
    return suscripcion


def _cancelacion_programada(suscripcion_stripe):
    if bool(_v(suscripcion_stripe, 'cancel_at_period_end', False)):
        return True
    return bool(_v(suscripcion_stripe, 'cancel_at'))


def _aplicar_suscripcion(
    negocio, suscripcion_stripe, event_created=None, event_id='',
):
    """Sincroniza una suscripción Stripe ya consultada en la API."""
    verificar_modo_test(suscripcion_stripe)
    stripe_id = _id(_v(suscripcion_stripe, 'id'))
    if not stripe_id:
        raise EventoStripeInvalido('La suscripción de Stripe no tiene id.')
    premium = _plan_premium()
    stripe_status = str(_v(suscripcion_stripe, 'status', '') or '')
    inicio_periodo, fin_periodo = _periodo_suscripcion(suscripcion_stripe)
    estado, gracia_fin, con_acceso = _mapear_estado(
        stripe_status, fin_periodo,
    )
    cancelada_en = _fecha(
        _v(suscripcion_stripe, 'canceled_at')
        or _v(suscripcion_stripe, 'ended_at')
    )
    programada = _cancelacion_programada(suscripcion_stripe)
    creada_en = _fecha(_v(suscripcion_stripe, 'created')) or timezone.now()
    price_id = _precio_id_suscripcion(suscripcion_stripe)

    with transaction.atomic():
        models.Negocio.objects.select_for_update().get(pk=negocio.pk)
        local = models.Suscripcion.objects.select_for_update().filter(
            stripe_subscription_id=stripe_id,
        ).first()
        if (
            local is not None
            and event_created is not None
            and local.ultimo_evento_stripe_creado is not None
            and event_created < local.ultimo_evento_stripe_creado
        ):
            return local, False

        plan_anterior = planes.plan_actual(negocio)
        ahora = timezone.now()

        # El cierre del plan anterior debe ocurrir ANTES de crear/activar la
        # suscripción Stripe: PostgreSQL impide dos suscripciones vigentes.
        if con_acceso:
            otras = models.Suscripcion.objects.select_for_update().filter(
                negocio=negocio,
                status__in=models.ESTADOS_SUSCRIPCION_VIGENTES,
            )
            if local is not None:
                otras = otras.exclude(pk=local.pk)
            for otra in otras:
                _cerrar_suscripcion(otra, ahora)

        if local is None:
            local = models.Suscripcion.objects.create(
                negocio=negocio,
                plan=premium,
                status=estado,
                origen='stripe',
                stripe_subscription_id=stripe_id,
                stripe_mode='test',
                stripe_status=stripe_status,
                stripe_price_id=price_id,
                periodo_actual_inicio=inicio_periodo,
                periodo_actual_fin=fin_periodo,
                en_cancelacion=programada and con_acceso,
                gracia_fin=gracia_fin if estado == 'pendiente' else None,
                fecha_inicio=creada_en,
                fecha_fin=(
                    cancelada_en or fin_periodo or ahora
                    if not con_acceso and estado in ('cancelada', 'incompleta')
                    else None
                ),
                ultimo_evento_stripe_id=event_id or '',
                ultimo_evento_stripe_creado=event_created,
            )
            if con_acceso:
                _auditar_cambio(
                    negocio, plan_anterior, premium,
                    'Activación de Premium verificada en Stripe Sandbox.',
                )
        else:
            if con_acceso and local.plan_id != premium.pk:
                _auditar_cambio(
                    negocio, local.plan, premium,
                    'Cambio a Premium verificado en Stripe Sandbox.',
                )
            local.plan = premium
            local.status = estado
            local.origen = 'stripe'
            local.stripe_mode = 'test'
            local.stripe_status = stripe_status
            local.stripe_price_id = price_id
            local.periodo_actual_inicio = inicio_periodo
            local.periodo_actual_fin = fin_periodo
            local.en_cancelacion = programada and con_acceso
            local.gracia_fin = gracia_fin if estado == 'pendiente' else None
            local.fecha_inicio = local.fecha_inicio or creada_en
            if con_acceso:
                local.fecha_fin = None
            elif estado in ('cancelada', 'incompleta'):
                local.fecha_fin = cancelada_en or fin_periodo or ahora
            if event_created is not None:
                local.ultimo_evento_stripe_id = event_id or ''
                local.ultimo_evento_stripe_creado = event_created
            local.save()

        if not con_acceso:
            _asegurar_free(negocio, plan_anterior=premium)

        return local, True


def _payment_intent_id(invoice):
    directo = _id(_v(invoice, 'payment_intent'))
    if directo:
        return directo
    for pago in _lista(invoice, 'payments'):
        intento = _id(_v(_v(pago, 'payment', {}), 'payment_intent'))
        if intento:
            return intento
    return ''


def _periodo_factura(invoice):
    inicio = _fecha(_v(invoice, 'period_start'))
    fin = _fecha(_v(invoice, 'period_end'))
    if inicio is not None and fin is not None:
        return inicio, fin
    for linea in _lista(invoice, 'lines'):
        periodo = _v(linea, 'period', {}) or {}
        inicio = inicio or _fecha(_v(periodo, 'start'))
        fin = fin or _fecha(_v(periodo, 'end'))
    return inicio, fin


def _estado_pago(invoice, tipo_evento=''):
    estado = str(_v(invoice, 'status', '') or '')
    if estado == 'paid':
        return 'pagado'
    if estado == 'void':
        return 'anulado'
    if estado == 'uncollectible':
        return 'fallido'
    if estado == 'open':
        return 'pendiente'
    if tipo_evento == 'invoice.payment_failed':
        return 'pendiente'
    return 'pendiente'


def _upsert_pago(invoice, cliente, event_created=None):
    """Persiste una factura sin duplicar pagos ni retroceder eventos."""
    verificar_modo_test(invoice)
    invoice_id = _id(_v(invoice, 'id'))
    if not invoice_id:
        raise EventoStripeInvalido('La factura de Stripe no tiene id.')
    parent = _v(invoice, 'parent', {}) or {}
    detalles = _v(parent, 'subscription_details', {}) or {}
    subscription_id = (
        _id(_v(detalles, 'subscription'))
        or _id(_v(invoice, 'subscription'))
    )
    if not subscription_id:
        return None

    local_sub = models.Suscripcion.objects.filter(
        stripe_subscription_id=subscription_id,
        stripe_mode='test',
    ).select_related('negocio').first()
    if local_sub is None:
        suscripcion_stripe = verificar_modo_test(_ejecutar(
            cliente.v1.subscriptions.retrieve, subscription_id,
        ))
        negocio = _negocio_desde_objeto(suscripcion_stripe)
        _aplicar_suscripcion(
            negocio, suscripcion_stripe,
            event_created=event_created,
            event_id=_id(_v(suscripcion_stripe, 'id')),
        )
        local_sub = models.Suscripcion.objects.filter(
            stripe_subscription_id=subscription_id,
            stripe_mode='test',
        ).select_related('negocio').first()
    if local_sub is None:
        raise EventoStripeInvalido(
            'La factura no corresponde a una suscripción Benefy conocida.'
        )

    customer_id = _id(_v(invoice, 'customer'))
    negocio_cliente = _obtener_negocio_por_customer(customer_id)
    if negocio_cliente is not None and negocio_cliente.pk != local_sub.negocio_id:
        raise EventoStripeInvalido(
            'El Customer de la factura no coincide con el negocio de la suscripción.'
        )

    existente = models.Pago.objects.filter(stripe_invoice_id=invoice_id).first()
    if (
        existente is not None
        and event_created is not None
        and existente.ultimo_evento_stripe_creado is not None
        and event_created < existente.ultimo_evento_stripe_creado
    ):
        return existente

    status = _estado_pago(invoice)
    centavos = 0
    if status == 'pagado':
        centavos = _v(invoice, 'amount_paid', 0)
    if not centavos:
        centavos = _v(invoice, 'amount_due', 0) or _v(
            invoice, 'amount_remaining', 0,
        ) or 0
    try:
        monto = (Decimal(int(centavos)) / Decimal('100')).quantize(
            Decimal('0.01'),
        )
    except (TypeError, ValueError):
        monto = Decimal('0.00')

    inicio_periodo, fin_periodo = _periodo_factura(invoice)
    transiciones = _v(invoice, 'status_transitions', {}) or {}
    pago, _ = models.Pago.objects.update_or_create(
        stripe_invoice_id=invoice_id,
        defaults={
            'stripe_payment_intent_id': _payment_intent_id(invoice) or None,
            'stripe_mode': 'test',
            'stripe_invoice_status': str(_v(invoice, 'status', '') or ''),
            'intentos_pago': int(_v(invoice, 'attempt_count', 0) or 0),
            'monto': monto,
            'divisa': str(_v(invoice, 'currency', 'MXN') or 'MXN').upper(),
            'status': status,
            'recibo_url': _v(invoice, 'hosted_invoice_url') or None,
            'periodo_inicio': inicio_periodo,
            'periodo_fin': fin_periodo,
            'pagado_en': _fecha(_v(transiciones, 'paid_at')),
            'ultimo_evento_stripe_creado': event_created,
            'negocio': local_sub.negocio,
            'suscripcion': local_sub,
        },
    )
    return pago


def _marcar_checkout(local, session):
    estado = str(_v(session, 'status', '') or '')
    ahora = timezone.now()
    if estado == 'complete':
        local.status = 'completada'
        local.completado_en = local.completado_en or ahora
    elif estado == 'expired':
        local.status = 'expirada'
    elif estado == 'open':
        local.status = 'abierta'
    local.url = str(_v(session, 'url', '') or local.url)
    local.stripe_session_id = _id(_v(session, 'id')) or local.stripe_session_id
    local.expira_en = _fecha(_v(session, 'expires_at')) or local.expira_en
    local.save(update_fields=[
        'status', 'url', 'stripe_session_id', 'expira_en', 'completado_en',
        'fecha_actualizacion',
    ])


def _sincronizar_sesion(session, event_created=None, event_id='', negocio_esperado=None):
    verificar_modo_test(session)
    if str(_v(session, 'mode', '')) != 'subscription':
        return False
    negocio = _negocio_desde_objeto(session, negocio_esperado=negocio_esperado)
    session_id = _id(_v(session, 'id'))
    local = models.CheckoutStripe.objects.filter(
        stripe_session_id=session_id,
        stripe_mode='test',
    ).first()
    if local is not None:
        _marcar_checkout(local, session)
    subscription_id = _id(_v(session, 'subscription'))
    if subscription_id:
        cliente = _cliente()
        suscripcion_stripe = verificar_modo_test(_ejecutar(
            cliente.v1.subscriptions.retrieve, subscription_id,
        ))
        _aplicar_suscripcion(
            negocio, suscripcion_stripe,
            event_created=event_created,
            event_id=event_id,
        )
    return True


def crear_sesion_checkout(negocio, usuario, intervalo):
    """Crea o reutiliza un Checkout de suscripción para el propietario."""
    _entorno_stripe()
    precio = precio_catalogo(intervalo)
    cliente = _cliente()
    _validar_precio_stripe(precio, cliente)

    with transaction.atomic():
        negocio = models.Negocio.objects.select_for_update().get(pk=negocio.pk)
        customer_local = _cliente_local(negocio)

        # Si el webhook se perdió, una suscripción remota vigente o impaga no
        # debe convertirse en una segunda suscripción.
        if customer_local is not None:
            remotas = _ejecutar(cliente.v1.subscriptions.list, {
                'customer': customer_local.stripe_customer_id,
                'status': 'all',
                'limit': 10,
            })
            relevantes = [
                item for item in _lista(remotas, 'data')
                if str(_v(item, 'status', '')) in (
                    'active', 'trialing', 'past_due', 'unpaid', 'incomplete',
                    'paused',
                )
            ]
            if relevantes:
                actual_remota = max(
                    relevantes, key=lambda item: int(_v(item, 'created', 0) or 0),
                )
                _aplicar_suscripcion(
                    negocio, actual_remota,
                    event_created=None, event_id='',
                )
                actual = planes.suscripcion_actual(negocio)
                if actual is not None and actual.plan.codigo == 'premium':
                    raise PremiumYaActivo(
                        'Ya existe una suscripción del plan premium activa en Stripe. '
                        'Administra la suscripción desde el portal.'
                    )
                raise PremiumYaActivo(
                    'Ya existe una suscripción de Stripe para este negocio. '
                    'Actualiza el pago o administra la suscripción.'
                )

        actual = planes.suscripcion_actual(negocio)
        if actual is not None and actual.plan.codigo == 'premium':
            raise PremiumYaActivo(
                'El negocio ya tiene el plan premium vigente. No se creó otro Checkout.'
            )

        customer = _obtener_o_crear_cliente(negocio, cliente)
        ahora = timezone.now()
        models.CheckoutStripe.objects.filter(
            negocio=negocio,
            stripe_mode='test',
            status='abierta',
            expira_en__lte=ahora,
        ).update(status='expirada', fecha_actualizacion=ahora)

        abierto = models.CheckoutStripe.objects.select_for_update().filter(
            negocio=negocio,
            stripe_mode='test',
            status='abierta',
        ).first()
        if abierto is not None and not (
            abierto.url
            and abierto.expira_en
            and abierto.stripe_session_id
        ):
            abierto.status = 'fallida'
            abierto.save(update_fields=['status', 'fecha_actualizacion'])
            abierto = None
        if (
            abierto is not None
            and abierto.expira_en > ahora
        ):
            session = verificar_modo_test(_ejecutar(
                cliente.v1.checkout.sessions.retrieve,
                abierto.stripe_session_id,
            ))
            if str(_v(session, 'status', '')) == 'open':
                return abierto, True
            _marcar_checkout(abierto, session)

        clave_idempotencia = (
            f'benefy-checkout-test-{negocio.pk}-{actual.pk if actual else 0}-'
            f'{intervalo}-{ahora:%Y%m%d}'
        )
        # Stripe exige entre 30 minutos y 24 horas para expires_at.
        minutos_checkout = min(
            max(settings.STRIPE_CHECKOUT_TTL_MINUTES, 30),
            24 * 60,
        )
        expira = ahora + timedelta(minutes=minutos_checkout)
        metadata = {
            'benefy_negocio_id': str(negocio.pk),
            'benefy_plan': 'premium',
            'benefy_intervalo': intervalo,
            'benefy_environment': 'sandbox',
        }
        session = verificar_modo_test(_ejecutar(
            cliente.v1.checkout.sessions.create,
            {
                'mode': 'subscription',
                'customer': customer.stripe_customer_id,
                'client_reference_id': str(negocio.pk),
                'line_items': [{
                    'price': precio.stripe_price_id,
                    'quantity': 1,
                }],
                'success_url': _url_checkout(negocio, 'success'),
                'cancel_url': _url_checkout(negocio, 'cancel'),
                'allow_promotion_codes': False,
                'locale': 'es',
                'expires_at': int(expira.timestamp()),
                'metadata': metadata,
                'subscription_data': {'metadata': metadata},
                'integration_identifier': (
                    f'benefy_saas_{uuid.uuid4().hex[:8]}'
                ),
            },
            options={'idempotency_key': clave_idempotencia},
        ))
        session_id = _id(_v(session, 'id'))
        url = str(_v(session, 'url', '') or '')
        if not session_id or not url:
            raise ErrorStripeAPI(
                'Stripe no devolvió una URL válida para el Checkout.'
            )
        try:
            local = models.CheckoutStripe.objects.create(
                negocio=negocio,
                usuario=usuario,
                plan_precio=precio,
                stripe_session_id=session_id,
                stripe_customer_id=customer.stripe_customer_id,
                idempotency_key=clave_idempotencia,
                intervalo=intervalo,
                monto=precio.monto,
                divisa=precio.divisa,
                status='abierta',
                url=url,
                stripe_mode='test',
                expira_en=_fecha(_v(session, 'expires_at')) or expira,
            )
        except IntegrityError:
            local = models.CheckoutStripe.objects.filter(
                negocio=negocio,
                stripe_mode='test',
                status='abierta',
            ).first()
            if local is None:
                raise
            return local, True
        _marcar_checkout(local, session)
        return local, False


def _configuracion_portal(cliente):
    configurada = (settings.STRIPE_PORTAL_CONFIGURATION_ID or '').strip()
    if configurada:
        if not configurada.startswith('bpc_'):
            raise StripeNoConfigurado(
                'STRIPE_PORTAL_CONFIGURATION_ID no tiene un formato válido.'
            )
        return configurada
    clave_cache = 'benefy.stripe.portal_config.test'
    existente = cache.get(clave_cache)
    if existente:
        return existente
    configuracion = verificar_modo_test(_ejecutar(
        cliente.v1.billing_portal.configurations.create,
        {
            'name': 'Benefy Sandbox',
            'default_return_url': _url_frontend('/portal'),
            'business_profile': {'headline': 'Benefy · suscripción de prueba'},
            'features': {
                'customer_update': {'enabled': False},
                'invoice_history': {'enabled': True},
                'payment_method_update': {'enabled': True},
                'subscription_cancel': {
                    'enabled': True,
                    'mode': 'at_period_end',
                    'cancellation_reason': {
                        'enabled': True,
                        'options': [
                            'too_expensive',
                            'missing_features',
                            'switched_service',
                            'unused',
                            'other',
                        ],
                    },
                },
                'subscription_update': {'enabled': False},
                'subscription_pause': {'enabled': False},
            },
        },
        options={'idempotency_key': 'benefy-portal-config-test-v1'},
    ))
    config_id = _id(_v(configuracion, 'id'))
    if not config_id:
        raise ErrorStripeAPI(
            'Stripe no devolvió la configuración del Customer Portal.'
        )
    cache.set(clave_cache, config_id, 60 * 60 * 23)
    return config_id


def crear_sesion_portal(negocio):
    _entorno_stripe()
    cliente = _cliente()
    local = _cliente_local(negocio)
    if local is None:
        raise PlanNoFacturable(
            'Este negocio todavía no tiene un Customer de Stripe Sandbox.'
        )
    configuracion = _configuracion_portal(cliente)
    session = verificar_modo_test(_ejecutar(
        cliente.v1.billing_portal.sessions.create,
        {
            'customer': local.stripe_customer_id,
            'return_url': _url_frontend(
                f'/portal/negocio/{negocio.pk}/suscripcion?portal=return',
            ),
            'configuration': configuracion,
        },
    ))
    url = str(_v(session, 'url', '') or '')
    if not url:
        raise ErrorStripeAPI(
            'Stripe no devolvió una URL para el Customer Portal.'
        )
    # No devolver el StripeObject a la vista: sus atributos no implementan
    # ``dict.get`` y el contrato HTTP debe ser un dato plano y estable.
    return {
        'id': _id(_v(session, 'id')),
        'url': url,
    }


def _suscripcion_referencia(negocio):
    actual = planes.suscripcion_actual(negocio)
    if actual is not None and actual.stripe_subscription_id:
        return actual
    return models.Suscripcion.objects.filter(
        negocio=negocio,
        stripe_mode='test',
    ).exclude(stripe_subscription_id__isnull=True).exclude(
        stripe_subscription_id='',
    ).order_by('-fecha_actualizacion', '-pk').first()


def datos_facturacion(negocio):
    resumen = planes.resumen_plan(negocio)
    referencia = _suscripcion_referencia(negocio)
    precios = []
    for intervalo in ('mensual', 'anual'):
        precio = models.PlanPrecio.objects.filter(
            plan__codigo='premium',
            plan__status=True,
            intervalo=intervalo,
            status=True,
        ).first()
        disponible = bool(
            precio
            and precio.monto is not None
            and (precio.stripe_price_id or '').startswith('price_')
        )
        precios.append({
            'intervalo': intervalo,
            'monto': str(precio.monto) if precio and precio.monto is not None else None,
            'divisa': precio.divisa if precio else 'MXN',
            'disponible': disponible,
        })

    cliente_local = _cliente_local(negocio)
    habilitada = False
    motivo = ''
    try:
        _entorno_stripe()
        habilitada = True
    except ErrorFacturacion as exc:
        motivo = str(exc.detail.get('detalle', 'Stripe Sandbox no está configurado.'))
    if habilitada and not any(item['disponible'] for item in precios):
        habilitada = False
        motivo = (
            'El catálogo del plan premium no está vinculado a Price IDs de Stripe '
            'Sandbox. Ejecuta configurar_stripe_sandbox.'
        )

    plan_codigo = resumen['plan']['codigo']
    estado_remoto = referencia.stripe_status if referencia else ''
    suscripcion_remota_relevante = estado_remoto in (
        'active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused',
    )
    puede_contratar = bool(
        habilitada
        and plan_codigo == 'free'
        and not suscripcion_remota_relevante
        and any(item['disponible'] for item in precios)
    )
    puede_administrar = bool(habilitada and cliente_local is not None)

    detalle_suscripcion = None
    if referencia is not None:
        con_acceso = plan_codigo == 'premium'
        detalle_suscripcion = {
            'id': referencia.pk,
            'status': referencia.status,
            'stripe_status': referencia.stripe_status,
            'origen': referencia.origen,
            'en_cancelacion': referencia.en_cancelacion,
            'gracia_fin': referencia.gracia_fin,
            'fecha_inicio': referencia.fecha_inicio,
            'fecha_fin': referencia.fecha_fin,
            'periodo_actual_inicio': referencia.periodo_actual_inicio,
            'periodo_actual_fin': referencia.periodo_actual_fin,
            'proxima_renovacion': (
                referencia.periodo_actual_fin
                if con_acceso and not referencia.en_cancelacion
                else None
            ),
            'cancelacion_programada': bool(
                con_acceso and referencia.en_cancelacion
            ),
            'acceso_premium': con_acceso,
        }

    pagos = [{
        'id': pago.pk,
        'fecha': pago.pagado_en or pago.fecha_pago,
        'monto': str(pago.monto),
        'divisa': pago.divisa,
        'status': pago.status,
        'stripe_invoice_status': pago.stripe_invoice_status,
        'intentos_pago': pago.intentos_pago,
        'periodo_inicio': pago.periodo_inicio,
        'periodo_fin': pago.periodo_fin,
        'recibo_url': pago.recibo_url,
    } for pago in models.Pago.objects.filter(
        negocio=negocio,
    ).order_by('-fecha_pago', '-pk')[:24]]

    webhook_configurado = bool(
        (settings.STRIPE_WEBHOOK_SECRET or '').startswith('whsec_')
        and 'REEMPLAZAR' not in (settings.STRIPE_WEBHOOK_SECRET or '').upper()
    )
    return {
        **resumen,
        'facturacion': {
            'habilitada': habilitada,
            'modo': 'test' if habilitada else 'deshabilitado',
            'motivo': motivo,
            'aviso': (
                'Pagos de prueba. No se realizan cargos reales.'
            ),
            'webhook_configurado': webhook_configurado,
            'precios': precios,
            'puede_contratar': puede_contratar,
            'puede_administrar': puede_administrar,
            'cliente_stripe_configurado': cliente_local is not None,
            'suscripcion': detalle_suscripcion,
            'pagos': pagos,
        },
    }


def reconciliar_negocio(negocio):
    _entorno_stripe()
    cliente = _cliente()
    local = _cliente_local(negocio)
    if local is None:
        return datos_facturacion(negocio)

    remotas = _ejecutar(cliente.v1.subscriptions.list, {
        'customer': local.stripe_customer_id,
        'status': 'all',
        'limit': 20,
    })
    items = _lista(remotas, 'data')
    relevantes = [
        item for item in items
        if str(_v(item, 'status', '')) in (
            'active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused',
        )
    ]
    if relevantes:
        elegida = max(
            relevantes, key=lambda item: int(_v(item, 'created', 0) or 0),
        )
        _aplicar_suscripcion(negocio, elegida, event_created=None)
    elif items:
        elegida = max(items, key=lambda item: int(_v(item, 'created', 0) or 0))
        _aplicar_suscripcion(negocio, elegida, event_created=None)

    facturas = _ejecutar(cliente.v1.invoices.list, {
        'customer': local.stripe_customer_id,
        'limit': 24,
    })
    for factura in _lista(facturas, 'data'):
        parent = _v(factura, 'parent', {}) or {}
        detalles = _v(parent, 'subscription_details', {}) or {}
        sub_id = (
            _id(_v(detalles, 'subscription'))
            or _id(_v(factura, 'subscription'))
        )
        if not sub_id:
            continue
        if not models.Suscripcion.objects.filter(
            stripe_subscription_id=sub_id, stripe_mode='test',
        ).exists():
            continue
        _upsert_pago(factura, cliente, event_created=None)

    return datos_facturacion(negocio)


def sincronizar_por_sesion(negocio, session_id):
    _entorno_stripe()
    if not isinstance(session_id, str) or not session_id.startswith('cs_test_'):
        raise SesionStripeInvalida(
            'El identificador de Checkout no es una sesión de Sandbox.'
        )
    cliente = _cliente()
    session = verificar_modo_test(_ejecutar(
        cliente.v1.checkout.sessions.retrieve, session_id,
    ))
    if str(_v(session, 'mode', '')) != 'subscription':
        raise SesionStripeInvalida('La sesión no corresponde a una suscripción.')
    _sincronizar_sesion(
        session, negocio_esperado=negocio,
    )
    return datos_facturacion(negocio)


def _reclamar_evento(evento):
    event_id = _id(_v(evento, 'id'))
    tipo = str(_v(evento, 'type', '') or '')
    if not event_id or not tipo:
        raise EventoStripeInvalido('El evento de Stripe no tiene id o tipo.')
    data = _v(evento, 'data', {}) or {}
    objeto = _v(data, 'object', {}) or {}
    creado = _v(evento, 'created')
    defaults = {
        'event_type': tipo,
        'object_id': _id(_v(objeto, 'id')),
        'stripe_created': int(creado) if creado else None,
        'stripe_mode': 'test',
        'livemode': False,
        'status': 'procesando',
        'fecha_evento': _fecha(creado),
    }
    with transaction.atomic():
        try:
            registro, creado_ahora = models.EventoStripe.objects.select_for_update().get_or_create(
                event_id=event_id,
                defaults=defaults,
            )
        except IntegrityError:
            registro = models.EventoStripe.objects.select_for_update().get(
                event_id=event_id,
            )
            creado_ahora = False
        if not creado_ahora:
            if registro.status in ('procesado', 'ignorado'):
                return registro, False
            reciente = (
                timezone.now() - registro.fecha_actualizacion
            ) < timedelta(minutes=5)
            if registro.status == 'procesando' and reciente:
                raise EventoEnProceso(
                    'El evento ya se está procesando. Stripe puede reintentar.'
                )
            registro.intentos += 1
            registro.status = 'procesando'
            registro.error = ''
            registro.save(update_fields=[
                'intentos', 'status', 'error', 'fecha_actualizacion',
            ])
        return registro, True


def _evento_obsoleto(evento, objeto_id):
    creado = _v(evento, 'created')
    if not creado:
        return False
    tipo = str(_v(evento, 'type', '') or '')
    if tipo.startswith('customer.subscription.'):
        local = models.Suscripcion.objects.filter(
            stripe_subscription_id=objeto_id,
        ).first()
        return bool(
            local
            and local.ultimo_evento_stripe_creado is not None
            and int(creado) < local.ultimo_evento_stripe_creado
        )
    if tipo in ('invoice.paid', 'invoice.payment_failed', 'invoice.payment_action_required'):
        pago = models.Pago.objects.filter(stripe_invoice_id=objeto_id).first()
        return bool(
            pago
            and pago.ultimo_evento_stripe_creado is not None
            and int(creado) < pago.ultimo_evento_stripe_creado
        )
    return False


def procesar_evento(evento):
    tipo = str(_v(evento, 'type', '') or '')
    data = _v(evento, 'data', {}) or {}
    objeto = _v(data, 'object', {}) or {}
    objeto_id = _id(_v(objeto, 'id'))
    creado = _v(evento, 'created')
    event_id = _id(_v(evento, 'id'))

    if _evento_obsoleto(evento, objeto_id):
        logger.info(
            'stripe_evento_obsoleto event_id=%s tipo=%s objeto=%s',
            event_id, tipo, objeto_id,
        )
        return False

    cliente = _cliente()
    if tipo.startswith('customer.subscription.'):
        if not objeto_id:
            raise EventoStripeInvalido('Evento de suscripción sin id.')
        actual = verificar_modo_test(_ejecutar(
            cliente.v1.subscriptions.retrieve, objeto_id,
        ))
        negocio = _negocio_desde_objeto(actual)
        _aplicar_suscripcion(
            negocio, actual, event_created=creado, event_id=event_id,
        )
        return True

    if tipo in (
        'invoice.paid',
        'invoice.payment_failed',
        'invoice.payment_action_required',
    ):
        if not objeto_id:
            raise EventoStripeInvalido('Evento de factura sin id.')
        factura = verificar_modo_test(_ejecutar(
            cliente.v1.invoices.retrieve, objeto_id,
        ))
        parent = _v(factura, 'parent', {}) or {}
        detalles = _v(parent, 'subscription_details', {}) or {}
        sub_id = (
            _id(_v(detalles, 'subscription'))
            or _id(_v(factura, 'subscription'))
        )
        if sub_id:
            suscripcion = verificar_modo_test(_ejecutar(
                cliente.v1.subscriptions.retrieve, sub_id,
            ))
            negocio = _negocio_desde_objeto(suscripcion)
            _aplicar_suscripcion(
                negocio, suscripcion,
                event_created=creado, event_id=event_id,
            )
        _upsert_pago(factura, cliente, event_created=creado)
        return True

    if tipo in ('checkout.session.completed', 'checkout.session.expired'):
        if not objeto_id:
            raise EventoStripeInvalido('Evento de Checkout sin id.')
        session = verificar_modo_test(_ejecutar(
            cliente.v1.checkout.sessions.retrieve, objeto_id,
        ))
        return _sincronizar_sesion(
            session, event_created=creado, event_id=event_id,
        )

    return False


def construir_evento(payload, signature):
    if not signature:
        raise FirmaWebhookInvalida('Falta la firma de Stripe.')
    cliente = _cliente(requiere_webhook=True)
    try:
        evento = cliente.construct_event(
            payload, signature, settings.STRIPE_WEBHOOK_SECRET,
        )
    except (stripe.SignatureVerificationError, ValueError):
        raise FirmaWebhookInvalida('Firma de webhook inválida.') from None
    if _v(evento, 'livemode') is not False:
        raise FirmaWebhookInvalida(
            'Se rechazó un evento que no declara livemode=false.'
        )
    if not _id(_v(evento, 'id')):
        raise FirmaWebhookInvalida('El evento no tiene identificador.')
    return evento


def procesar_webhook(payload, signature):
    evento = construir_evento(payload, signature)
    registro, debe_procesar = _reclamar_evento(evento)
    if not debe_procesar:
        return {
            'recibido': True,
            'duplicado': True,
            'event_id': registro.event_id,
        }
    try:
        manejado = procesar_evento(evento)
    except Exception as exc:
        registro.status = 'fallido'
        registro.error = _limpiar_error(exc)
        registro.fecha_procesado = timezone.now()
        registro.save(update_fields=[
            'status', 'error', 'fecha_procesado', 'fecha_actualizacion',
        ])
        logger.warning(
            'stripe_webhook_fallido event_id=%s tipo=%s detalle=%s',
            registro.event_id,
            registro.event_type,
            _limpiar_error(exc),
        )
        raise
    registro.status = 'procesado' if manejado else 'ignorado'
    registro.error = ''
    registro.fecha_procesado = timezone.now()
    registro.save(update_fields=[
        'status', 'error', 'fecha_procesado', 'fecha_actualizacion',
    ])
    logger.info(
        'stripe_webhook_procesado event_id=%s tipo=%s estado=%s',
        registro.event_id,
        registro.event_type,
        registro.status,
    )
    return {
        'recibido': True,
        'duplicado': False,
        'event_id': registro.event_id,
        'procesado': manejado,
    }
