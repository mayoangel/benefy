"""Reglas de negocio para propuestas, aceptación y beneficios de alianzas."""

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import APIException

from core import models, permissions
from core.services import planes


class ErrorAlianza(APIException):
    """Error estable para que el portal pueda mostrar el motivo."""

    def __init__(self, detalle, codigo='alianza_invalida', status_code=400):
        self.status_code = status_code
        super().__init__(detail={'codigo': codigo, 'detalle': detalle})


def es_dueno(user, negocio):
    """Comprueba una membresía de dueño sin incluir al admin del sistema."""
    return models.UsuarioNegocio.objects.filter(
        usuario=user,
        negocio=negocio,
        rol_comercio='dueno',
        sucursal__isnull=True,
        status=True,
    ).exists()


def _validar_dueno(user, negocio):
    if not es_dueno(user, negocio):
        raise ErrorAlianza(
            'Solo el propietario del negocio puede administrar sus alianzas.',
            codigo='sin_permiso_alianza',
            status_code=403,
        )


def _validar_fechas(fecha_inicio, fecha_fin):
    if fecha_fin <= fecha_inicio:
        raise ErrorAlianza('La fecha de fin debe ser posterior a la fecha de inicio.')
    if fecha_fin <= timezone.now():
        raise ErrorAlianza('La fecha de fin de la alianza debe ser futura.')


def _validar_puede_proponer(negocio):
    if not planes.tiene_caracteristica(negocio, 'alianzas_proponer'):
        raise planes.LimitePlan(
            'El plan actual no permite enviar solicitudes de alianza. '
            'Puedes recibir y aceptar solicitudes dentro de tu cupo.'
        )


def _registrar_evento(alianza, accion, actor, detalle=''):
    return models.EventoAlianza.objects.create(
        alianza=alianza,
        accion=accion,
        actor=actor,
        actor_correo=getattr(actor, 'correo', '') or '',
        detalle=detalle,
    )


def puede_ver(user, alianza):
    if permissions.es_admin_sistema(user):
        return True
    return es_dueno(user, alianza.negocio1) or es_dueno(user, alianza.negocio2)


def listar_alianzas(*, usuario, negocio=None, vista=None):
    """Devuelve las alianzas visibles para el dueño o el admin."""
    queryset = models.Alianza.objects.select_related(
        'negocio1', 'negocio1__categoria', 'negocio2', 'negocio2__categoria',
        'creado_por', 'respondido_por',
    ).prefetch_related('recompensas', 'eventos__actor')

    if permissions.es_admin_sistema(usuario):
        if negocio is not None:
            queryset = queryset.filter(Q(negocio1=negocio) | Q(negocio2=negocio))
    else:
        negocios = permissions.negocios_administrados(usuario)
        if negocio is not None:
            if not negocios.filter(pk=negocio.pk).exists():
                raise ErrorAlianza(
                    'No tienes permisos para consultar las alianzas de este negocio.',
                    codigo='sin_permiso_alianza',
                    status_code=403,
                )
            queryset = queryset.filter(Q(negocio1=negocio) | Q(negocio2=negocio))
        else:
            queryset = queryset.filter(
                Q(negocio1__in=negocios) | Q(negocio2__in=negocios),
            )

    if negocio is not None and vista:
        if vista == 'recibidas':
            queryset = queryset.filter(negocio2=negocio, status='pendiente')
        elif vista == 'enviadas':
            queryset = queryset.filter(negocio1=negocio, status='pendiente')
        elif vista == 'activas':
            queryset = queryset.filter(
                Q(negocio1=negocio) | Q(negocio2=negocio),
                status='activa',
            )
        elif vista == 'historial':
            queryset = queryset.filter(
                Q(negocio1=negocio) | Q(negocio2=negocio),
                status__in=('rechazada', 'finalizada'),
            )
        else:
            raise ErrorAlianza('La vista de alianzas no es válida.')

    return queryset.distinct()


def detalle_alianza(*, usuario, alianza_id):
    alianza = models.Alianza.objects.select_related(
        'negocio1', 'negocio1__categoria', 'negocio2', 'negocio2__categoria',
        'creado_por', 'respondido_por',
    ).prefetch_related('recompensas', 'eventos__actor').filter(
        pk=alianza_id,
    ).first()
    if alianza is None:
        raise ErrorAlianza(
            'La alianza no existe.', codigo='alianza_no_encontrada', status_code=404,
        )
    if not puede_ver(usuario, alianza):
        raise ErrorAlianza(
            'No tienes permisos para consultar esta alianza.',
            codigo='sin_permiso_alianza',
            status_code=403,
        )
    return alianza


def descubrir_negocios(*, usuario, negocio, buscar='', categoria=None):
    """Directorio mínimo de negocios activos, sin datos privados."""
    _validar_dueno(usuario, negocio)
    if not negocio.status:
        raise ErrorAlianza('El negocio debe estar activo para buscar alianzas.')

    excluidos = models.Alianza.objects.filter(
        status__in=('pendiente', 'activa'),
        fecha_fin__gte=timezone.now(),
    ).filter(
        Q(negocio1=negocio) | Q(negocio2=negocio),
    ).values_list('negocio1_id', 'negocio2_id')
    ids_excluidos = {negocio.pk}
    for negocio1_id, negocio2_id in excluidos:
        ids_excluidos.add(negocio1_id)
        ids_excluidos.add(negocio2_id)

    queryset = models.Negocio.objects.filter(status=True).exclude(
        pk__in=ids_excluidos,
    ).select_related('categoria')
    if buscar:
        queryset = queryset.filter(
            Q(nombre__icontains=buscar)
            | Q(descripcion__icontains=buscar)
            | Q(direccion__icontains=buscar)
            | Q(categoria__nombre__icontains=buscar)
        )
    if categoria is not None:
        queryset = queryset.filter(categoria=categoria)
    return queryset.order_by('nombre')[:50]


@transaction.atomic
def crear_solicitud(
    *, usuario, negocio_origen, negocio_destino, condicion_participacion,
    fecha_inicio, fecha_fin,
):
    _validar_dueno(usuario, negocio_origen)
    if not negocio_origen.status:
        raise ErrorAlianza('El negocio que propone la alianza debe estar activo.')
    if not negocio_destino.status:
        raise ErrorAlianza('El negocio destinatario debe estar activo.')
    if negocio_origen.pk == negocio_destino.pk:
        raise ErrorAlianza('Un negocio no puede crear una alianza consigo mismo.')
    condicion_participacion = (condicion_participacion or '').strip()
    if not condicion_participacion:
        raise ErrorAlianza('La condición de participación no puede estar vacía.')
    _validar_fechas(fecha_inicio, fecha_fin)

    # Bloquear ambos negocios serializa la propuesta con cambios de plan y
    # evita propuestas duplicadas concurrentes.
    list(models.Negocio.objects.select_for_update().filter(
        pk__in=(negocio_origen.pk, negocio_destino.pk),
    ).order_by('pk'))
    _validar_puede_proponer(negocio_origen)

    existente = models.Alianza.objects.select_for_update().filter(
        status__in=('pendiente', 'activa'),
        fecha_fin__gte=timezone.now(),
    ).filter(
        Q(negocio1=negocio_origen, negocio2=negocio_destino)
        | Q(negocio1=negocio_destino, negocio2=negocio_origen),
    ).exists()
    if existente:
        raise ErrorAlianza(
            'Ya existe una solicitud pendiente o una alianza activa con este negocio.',
            codigo='alianza_duplicada',
            status_code=409,
        )

    alianza = models.Alianza.objects.create(
        negocio1=negocio_origen,
        negocio2=negocio_destino,
        condicion_participacion=condicion_participacion,
        status='pendiente',
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        creado_por=usuario,
    )
    _registrar_evento(
        alianza, 'solicitud', usuario,
        f'Propuesta enviada a {negocio_destino.nombre}.',
    )
    return alianza


@transaction.atomic
def responder_solicitud(*, usuario, alianza_id, aceptar, ahora=None):
    ahora = ahora or timezone.now()
    alianza = models.Alianza.objects.select_for_update().select_related(
        'negocio1', 'negocio2',
    ).filter(pk=alianza_id).first()
    if alianza is None:
        raise ErrorAlianza(
            'La alianza no existe.', codigo='alianza_no_encontrada', status_code=404,
        )
    _validar_dueno(usuario, alianza.negocio2)
    if alianza.status != 'pendiente':
        raise ErrorAlianza(
            'Esta solicitud ya fue respondida.',
            codigo='alianza_ya_respondida',
            status_code=409,
        )
    if not alianza.negocio1.status or not alianza.negocio2.status:
        raise ErrorAlianza(
            'Ambos negocios deben estar activos para aceptar la alianza.',
            codigo='negocio_inactivo',
            status_code=409,
        )
    if alianza.fecha_fin <= ahora:
        raise ErrorAlianza(
            'La vigencia propuesta ya terminó.', codigo='alianza_vencida',
            status_code=409,
        )

    if aceptar:
        planes.verificar_capacidad_alianza(
            alianza.negocio1, alianza.negocio2,
        )
        duplicada = models.Alianza.objects.filter(
            status__in=('pendiente', 'activa'),
            fecha_fin__gte=ahora,
        ).filter(
            Q(negocio1=alianza.negocio1, negocio2=alianza.negocio2)
            | Q(negocio1=alianza.negocio2, negocio2=alianza.negocio1),
        ).exclude(pk=alianza.pk).exists()
        if duplicada:
            raise ErrorAlianza(
                'Ya existe otra solicitud pendiente o alianza activa con este negocio.',
                codigo='alianza_duplicada',
                status_code=409,
            )
        alianza.status = 'activa'
    else:
        alianza.status = 'rechazada'

    alianza.fecha_respuesta = ahora
    alianza.respondido_por = usuario
    alianza.save(update_fields=[
        'status', 'fecha_respuesta', 'respondido_por',
    ])
    _registrar_evento(
        alianza,
        'aceptacion' if aceptar else 'rechazo',
        usuario,
        'La alianza quedó activa.' if aceptar else 'La solicitud fue rechazada.',
    )
    return alianza


@transaction.atomic
def finalizar_alianza(*, usuario, alianza_id, ahora=None):
    ahora = ahora or timezone.now()
    alianza = models.Alianza.objects.select_for_update().select_related(
        'negocio1', 'negocio2',
    ).filter(pk=alianza_id).first()
    if alianza is None:
        raise ErrorAlianza(
            'La alianza no existe.', codigo='alianza_no_encontrada', status_code=404,
        )
    if not (
        es_dueno(usuario, alianza.negocio1)
        or es_dueno(usuario, alianza.negocio2)
    ):
        raise ErrorAlianza(
            'Solo los propietarios de la alianza pueden finalizarla.',
            codigo='sin_permiso_alianza',
            status_code=403,
        )
    if alianza.status != 'activa':
        raise ErrorAlianza(
            'Solo una alianza activa puede finalizarse.',
            codigo='alianza_no_activa',
            status_code=409,
        )

    alianza.status = 'finalizada'
    alianza.save(update_fields=['status'])
    _registrar_evento(
        alianza, 'finalizacion', usuario,
        'La alianza se marcó como finalizada; sus beneficios dejan de estar vigentes.',
    )
    # No se eliminan las recompensas: el catálogo ya las oculta cuando la
    # alianza no está activa y se conserva el historial de cupones emitidos.
    return alianza


@transaction.atomic
def crear_recompensa(*, usuario, alianza, negocio, datos):
    if not puede_ver(usuario, alianza):
        raise ErrorAlianza(
            'No tienes permisos para administrar los beneficios de esta alianza.',
            codigo='sin_permiso_alianza',
            status_code=403,
        )
    if negocio.pk not in (alianza.negocio1_id, alianza.negocio2_id):
        raise ErrorAlianza('El beneficio debe pertenecer a uno de los negocios de la alianza.')
    _validar_dueno(usuario, negocio)
    ahora = timezone.now()
    if (
        alianza.status != 'activa'
        or alianza.fecha_inicio > ahora
        or alianza.fecha_fin <= ahora
    ):
        raise ErrorAlianza(
            'Solo puedes agregar beneficios a una alianza activa y vigente.',
            codigo='alianza_no_activa',
            status_code=409,
        )
    planes.verificar_capacidad(negocio, 'recompensas')
    datos = dict(datos)
    datos.pop('alianza', None)
    datos.pop('negocio', None)
    recompensa = models.Recompensa.objects.create(
        alianza=alianza,
        negocio=negocio,
        **datos,
    )
    _registrar_evento(
        alianza, 'recompensa', usuario,
        f'Beneficio “{recompensa.titulo}” agregado para {negocio.nombre}.',
    )
    return recompensa
