"""Consultas analíticas de solo lectura para Benef AI.

La autorización se aplica aquí, en Django, con el mismo alcance por negocio,
sucursal y rol que el resto del portal. Los resultados se limitan y se devuelven
sin correos, tokens ni identificadores internos innecesarios.
"""

from datetime import timedelta
from zoneinfo import ZoneInfo

from django.core.exceptions import PermissionDenied
from django.db.models import Count, Max, Q, Sum
from django.utils import timezone

from core import access, models, permissions
from core.services import planes
from core.services.benef_ai_tiempo import (
    ErrorPeriodo,
    Rango,
    limites_datetime,
    resolver_rango,
)

TEMAS = (
    'resumen', 'visitas', 'clientes', 'puntos', 'tarjetas',
    'recompensas', 'cupones', 'canjes', 'sucursales', 'equipo',
    'alianzas', 'plan', 'negocio',
)
ORDENES_CLIENTES = ('visitas', 'canjes', 'ultima_visita', 'puntos', 'nombre')
ESTADOS_ALIANZA = ('pendiente', 'activa', 'finalizada', 'rechazada')
MAX_RESULTADOS = 20
MAX_CANDIDATOS_CLIENTES = 1000
DIAS_SEMANA = ('lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo')


class ErrorConsulta(ValueError):
    """Parámetros de consulta inválidos."""


def _zona(negocio) -> ZoneInfo:
    from core.utils.tiempo import zona_del_negocio
    return zona_del_negocio(negocio)


def _iso(valor, negocio):
    if valor is None:
        return None
    if timezone.is_naive(valor):
        valor = timezone.make_aware(valor, timezone.utc)
    return valor.astimezone(_zona(negocio)).isoformat(timespec='seconds')


def _fecha_iso(valor):
    return valor.isoformat() if valor else None


def _delta(actual, anterior):
    diferencia = actual - anterior
    porcentaje = None if anterior == 0 else round(diferencia / anterior * 100, 1)
    return {
        'actual': actual,
        'anterior': anterior,
        'diferencia': diferencia,
        'porcentaje': porcentaje,
    }


def _entero(valor, nombre):
    try:
        return int(valor)
    except (TypeError, ValueError):
        raise ErrorConsulta(f'{nombre} debe ser un entero.') from None


def _booleano(valor, defecto=False):
    if valor is None:
        return defecto
    if isinstance(valor, bool):
        return valor
    return str(valor).strip().lower() in ('1', 'true', 'si', 'sí')


def _alcance(usuario, negocio, sucursal_id=None):
    if permissions.es_admin_sistema(usuario):
        raise PermissionDenied(
            'Benef AI está disponible únicamente para usuarios de negocio.'
        )
    membresias = list(
        models.UsuarioNegocio.objects.filter(
            usuario=usuario,
            negocio=negocio,
            status=True,
        ).select_related('sucursal')
    )
    if not membresias:
        raise PermissionDenied('No tienes acceso a este negocio.')
    es_dueno = any(
        item.rol_comercio == 'dueno' and item.sucursal_id is None
        for item in membresias
    )
    autorizadas = list(
        models.Sucursal.objects.filter(negocio=negocio, status=True)
        .order_by('nombre')
    ) if es_dueno else list(
        models.Sucursal.objects.filter(
            pk__in={
                item.sucursal_id for item in membresias
                if item.rol_comercio in ('supervisor', 'empleado') and item.sucursal_id
            },
            negocio=negocio,
            status=True,
        ).order_by('nombre')
    )
    seleccionada = None
    if sucursal_id is not None:
        seleccionada = next(
            (item for item in autorizadas if item.pk == sucursal_id), None
        )
        if seleccionada is None:
            raise PermissionDenied('No tienes acceso a esa sucursal.')
    if seleccionada is not None:
        filtro_sucursales = [seleccionada.pk]
    elif not es_dueno:
        filtro_sucursales = [item.pk for item in autorizadas]
    else:
        filtro_sucursales = None
    return {
        'es_dueno': es_dueno,
        'rol': 'dueno' if es_dueno else (
            'supervisor' if any(
                item.rol_comercio == 'supervisor' for item in membresias
            ) else 'empleado'
        ),
        'autorizadas': autorizadas,
        'seleccionada': seleccionada,
        'filtro_sucursales': filtro_sucursales,
    }


def _rango(negocio, periodo, desde, hasta, ahora=None):
    try:
        return resolver_rango(
            negocio, periodo=periodo, desde=desde, hasta=hasta, ahora=ahora,
        )
    except ErrorPeriodo as exc:
        raise ErrorConsulta(str(exc)) from None


def _visitas_qs(negocio, rango, filtro_sucursales):
    query = models.RegistroActividad.objects.filter(
        negocio=negocio,
        tipo='visita',
        fecha_negocio__range=(rango.desde, rango.hasta),
    )
    if filtro_sucursales is not None:
        query = query.filter(sucursal_id__in=filtro_sucursales)
    return query


def _canjes_qs(negocio, rango, filtro_sucursales):
    inicio, fin = limites_datetime(negocio, rango)
    query = models.Canje.objects.filter(
        negocio=negocio,
        fecha__gte=inicio,
        fecha__lt=fin,
    )
    if filtro_sucursales is not None:
        query = query.filter(sucursal_id__in=filtro_sucursales)
    return query


def _cupones_qs(negocio, rango):
    inicio, fin = limites_datetime(negocio, rango)
    return models.CuponUsuario.objects.filter(
        negocio=negocio,
        fecha_emision__gte=inicio,
        fecha_emision__lt=fin,
    )


def _movimientos_qs(negocio, rango):
    inicio, fin = limites_datetime(negocio, rango)
    return models.MovimientoPuntos.objects.filter(
        negocio=negocio,
        fecha__gte=inicio,
        fecha__lt=fin,
    )


def _periodo_dict(rango):
    return rango.como_dict()


def _resumen(usuario, negocio, alcance, rango, comparar):
    visitas = _visitas_qs(negocio, rango, alcance['filtro_sucursales'])
    validas = visitas.filter(es_valida=True)
    anuladas = visitas.filter(es_valida=False)
    canjes = _canjes_qs(negocio, rango, alcance['filtro_sucursales'])
    actual = {
        'visitas_validas': validas.count(),
        'visitas_anuladas': anuladas.count(),
        'clientes_unicos': validas.values('usuario_id').distinct().count(),
        'canjes': canjes.filter(anulado=False).count(),
        'canjes_anulados': canjes.filter(anulado=True).count(),
    }
    anterior = None
    if comparar:
        previo = rango.anterior
        visitas_prev = _visitas_qs(negocio, previo, alcance['filtro_sucursales'])
        canjes_prev = _canjes_qs(negocio, previo, alcance['filtro_sucursales'])
        anterior = {
            'visitas_validas': visitas_prev.filter(es_valida=True).count(),
            'clientes_unicos': visitas_prev.filter(es_valida=True)
            .values('usuario_id').distinct().count(),
            'canjes': canjes_prev.filter(anulado=False).count(),
        }

    datos = {
        'periodo': _periodo_dict(rango),
        **actual,
        'comparacion': (
            {
                'visitas_validas': _delta(
                    actual['visitas_validas'], anterior['visitas_validas'],
                ),
                'clientes_unicos': _delta(
                    actual['clientes_unicos'], anterior['clientes_unicos'],
                ),
                'canjes': _delta(actual['canjes'], anterior['canjes']),
            }
            if anterior is not None else None
        ),
        'por_sucursal': [
            {
                'sucursal': fila['sucursal__nombre'] or 'QR del negocio',
                'visitas': fila['total'],
            }
            for fila in validas.values(
                'sucursal__nombre',
            ).annotate(total=Count('id')).order_by('-total')[:5]
        ],
    }
    if alcance['es_dueno']:
        movimientos = _movimientos_qs(negocio, rango)
        cupones = _cupones_qs(negocio, rango)
        datos['puntos'] = {
            'otorgados': movimientos.filter(tipo='otorgado').aggregate(
                total=Sum('cantidad'),
            )['total'] or 0,
            'consumidos': abs(movimientos.filter(tipo='consumido').aggregate(
                total=Sum('cantidad'),
            )['total'] or 0),
        }
        datos['cupones'] = {
            'emitidos': cupones.count(),
            'canjeados': cupones.filter(status='canjeado').count(),
            'disponibles': cupones.filter(
                status='disponible', fecha_expiracion__gte=timezone.now(),
            ).count(),
        }
        datos['tarjetas_completadas'] = models.CicloTarjeta.objects.filter(
            negocio=negocio,
            estado='completado',
            **{'fecha_fin__gte': limites_datetime(negocio, rango)[0],
               'fecha_fin__lt': limites_datetime(negocio, rango)[1]},
        ).count()
        datos['sucursales_activas'] = len(alcance['autorizadas'])
        datos['alianzas_activas'] = planes.uso_actual(negocio, 'alianzas_activas')
    else:
        datos['puntos'] = None
        datos['cupones'] = None
        datos['nota_privacidad'] = (
            'Las métricas de puntos, cupones y tarjetas solo están disponibles '
            'para el propietario del negocio.'
        )
    return datos


def _buckets(negocio, rango, filas):
    por_dia = {fila['fecha_negocio']: fila['total'] for fila in filas}
    dias = rango.dias
    if dias <= 31:
        return 'dia', [
            {
                'desde': (rango.desde + timedelta(days=i)).isoformat(),
                'total': por_dia.get(rango.desde + timedelta(days=i), 0),
            }
            for i in range(dias)
        ]
    if dias <= 120:
        salida = []
        cursor = rango.desde - timedelta(days=rango.desde.weekday())
        while cursor <= rango.hasta:
            fin = min(cursor + timedelta(days=6), rango.hasta)
            total = sum(
                por_dia.get(cursor + timedelta(days=i), 0)
                for i in range((fin - cursor).days + 1)
            )
            salida.append({'desde': cursor.isoformat(), 'hasta': fin.isoformat(), 'total': total})
            cursor += timedelta(days=7)
        return 'semana', salida
    salida = []
    cursor = rango.desde.replace(day=1)
    while cursor <= rango.hasta:
        siguiente = (cursor.replace(day=28) + timedelta(days=4)).replace(day=1)
        fin = min(siguiente - timedelta(days=1), rango.hasta)
        total = sum(
            valor for fecha, valor in por_dia.items() if cursor <= fecha <= fin
        )
        salida.append({'desde': cursor.isoformat(), 'hasta': fin.isoformat(), 'total': total})
        cursor = siguiente
    return 'mes', salida


def _top_clientes(negocio, visitas, limite=5):
    filas = visitas.filter(es_valida=True).values(
        'usuario_id', 'usuario__nombre', 'usuario__apellido',
    ).annotate(total=Count('id'), ultima=Max('fecha')).order_by('-total', 'usuario__nombre')[:limite]
    return [
        {
            'nombre': f"{fila['usuario__nombre']} {fila['usuario__apellido']}".strip(),
            'visitas': fila['total'],
            'ultima_visita': _iso(fila['ultima'], negocio),
        }
        for fila in filas
    ]


def _visitas(usuario, negocio, alcance, rango, comparar, limite):
    visitas = _visitas_qs(negocio, rango, alcance['filtro_sucursales'])
    validas = visitas.filter(es_valida=True)
    por_dia = validas.values('fecha_negocio').annotate(
        total=Count('id'),
    ).order_by('fecha_negocio')
    granularidad, evolucion = _buckets(negocio, rango, por_dia)
    por_sucursal = [
        {
            'sucursal': fila['sucursal__nombre'] or 'QR del negocio',
            'visitas': fila['total'],
        }
        for fila in validas.values('sucursal__nombre').annotate(
            total=Count('id'),
        ).order_by('-total')
    ]
    por_dia_semana = [0] * 7
    for fila in por_dia:
        por_dia_semana[fila['fecha_negocio'].weekday()] += fila['total']
    top_dias = sorted(
        (
            {'fecha': fila['fecha_negocio'].isoformat(), 'visitas': fila['total']}
            for fila in por_dia
        ),
        key=lambda item: item['visitas'],
        reverse=True,
    )[:5]
    datos = {
        'periodo': _periodo_dict(rango),
        'visitas_validas': validas.count(),
        'visitas_anuladas': visitas.filter(es_valida=False).count(),
        'clientes_unicos': validas.values('usuario_id').distinct().count(),
        'evolucion': {
            'granularidad': granularidad,
            'puntos': evolucion,
        },
        'por_sucursal': por_sucursal,
        'dias_semana': dict(zip(DIAS_SEMANA, por_dia_semana)),
        'dias_mayor_actividad': top_dias,
        'top_clientes': (
            _top_clientes(negocio, validas, limite)
            if alcance['es_dueno'] else None
        ),
    }
    if not alcance['es_dueno']:
        datos['nota_privacidad'] = (
            'El ranking nominal de clientes solo está disponible para el propietario.'
        )
    if comparar:
        previo = rango.anterior
        visitas_prev = _visitas_qs(negocio, previo, alcance['filtro_sucursales'])
        previas = visitas_prev.filter(es_valida=True)
        datos['comparacion'] = {
            'visitas_validas': _delta(validas.count(), previas.count()),
            'clientes_unicos': _delta(
                validas.values('usuario_id').distinct().count(),
                previas.values('usuario_id').distinct().count(),
            ),
        }
    return datos


def _clientes(usuario, negocio, alcance, rango, orden, limite, incluir_inactivos):
    if not alcance['es_dueno']:
        raise PermissionDenied(
            'Solo el propietario puede consultar el ranking de clientes.'
        )
    if orden not in ORDENES_CLIENTES:
        raise ErrorConsulta(
            'Orden no válido. Usa: ' + ', '.join(ORDENES_CLIENTES) + '.'
        )
    visitas = _visitas_qs(
        negocio, rango, alcance['filtro_sucursales'],
    ).filter(es_valida=True)
    actuales = {
        fila['usuario_id']: fila
        for fila in visitas.values('usuario_id').annotate(
            visitas=Count('id'), ultima=Max('fecha'),
        )
    }
    historicas_qs = models.RegistroActividad.objects.filter(
        negocio=negocio, tipo='visita', es_valida=True,
    )
    if alcance['filtro_sucursales'] is not None:
        historicas_qs = historicas_qs.filter(
            sucursal_id__in=alcance['filtro_sucursales'],
        )
    historicas = {
        fila['usuario_id']: fila
        for fila in historicas_qs.values('usuario_id').annotate(
            total=Count('id'), ultima=Max('fecha'),
        ).order_by('-ultima')[:MAX_CANDIDATOS_CLIENTES]
    }
    canjes = {
        fila['cupon__usuario_id']: fila
        for fila in _canjes_qs(
            negocio, rango, alcance['filtro_sucursales'],
        ).filter(
            anulado=False,
        ).values('cupon__usuario_id').annotate(
            total=Count('id'), ultima=Max('fecha'),
        )
    }
    ids = set(actuales) | set(canjes)
    if incluir_inactivos:
        ids |= set(historicas)
        ids |= set(
            models.SaldoPuntos.objects.filter(negocio=negocio)
            .order_by('-saldo_actual')
            .values_list('usuario_id', flat=True)[:MAX_CANDIDATOS_CLIENTES]
        )
    saldos = {
        fila['usuario_id']: fila['saldo_actual']
        for fila in models.SaldoPuntos.objects.filter(
            negocio=negocio, usuario_id__in=ids,
        ).values('usuario_id', 'saldo_actual')
    }
    usuarios = {
        fila['id']: fila
        for fila in models.Usuario.objects.filter(pk__in=ids).values(
            'id', 'nombre', 'apellido',
        )
    }
    resultados = []
    for usuario_id in ids:
        persona = usuarios.get(usuario_id)
        if persona is None:
            continue
        visita = actuales.get(usuario_id)
        historica = historicas.get(usuario_id)
        canje = canjes.get(usuario_id)
        if not incluir_inactivos and visita is None:
            continue
        if visita is not None:
            estado = 'activo'
        elif historica is not None:
            estado = 'inactivo'
        else:
            estado = 'sin_visitas'
        if not incluir_inactivos and estado != 'activo':
            continue
        resultados.append({
            'nombre': f"{persona['nombre']} {persona['apellido']}".strip(),
            'visitas': visita['visitas'] if visita else 0,
            'canjes': canje['total'] if canje else 0,
            'puntos': saldos.get(usuario_id, 0),
            'ultima_visita': _iso(
                (visita or {}).get('ultima') or (historica or {}).get('ultima'),
                negocio,
            ),
            'frecuencia_30_dias': (
                round((visita['visitas'] if visita else 0) / rango.dias * 30, 1)
            ),
            'estado': estado,
        })
    if orden == 'visitas':
        resultados.sort(key=lambda item: (-item['visitas'], item['nombre']))
    elif orden == 'canjes':
        resultados.sort(key=lambda item: (-item['canjes'], item['nombre']))
    elif orden == 'puntos':
        resultados.sort(key=lambda item: (-item['puntos'], item['nombre']))
    elif orden == 'ultima_visita':
        resultados.sort(
            key=lambda item: (item['ultima_visita'] or '', item['nombre']),
            reverse=True,
        )
    else:
        resultados.sort(key=lambda item: item['nombre'])
    return {
        'periodo': _periodo_dict(rango),
        'total_candidatos': len(resultados),
        'activos': sum(item['estado'] == 'activo' for item in resultados),
        'inactivos': sum(item['estado'] == 'inactivo' for item in resultados),
        'resultados': resultados[:limite],
        'criterio': (
            'Activo: al menos una visita válida en el periodo. Inactivo: sin '
            'visitas en el periodo pero con historial previo. Los puntos y '
            'canjes son del periodo consultado salvo el saldo actual.'
        ),
    }


def _puntos(usuario, negocio, alcance, rango):
    if not alcance['es_dueno']:
        raise PermissionDenied(
            'Solo el propietario puede consultar puntos y tarjetas.'
        )
    movimientos = _movimientos_qs(negocio, rango)
    por_tipo = {
        fila['tipo']: fila['total']
        for fila in movimientos.values('tipo').annotate(total=Sum('cantidad'))
    }
    ahora = timezone.now()
    saldo_total = models.SaldoPuntos.objects.filter(
        negocio=negocio,
    ).aggregate(total=Sum('saldo_actual'))['total'] or 0
    lotes = models.LotePuntos.objects.filter(
        negocio=negocio, cantidad_disponible__gt=0,
    ).filter(Q(fecha_expiracion__isnull=True) | Q(fecha_expiracion__gt=ahora))
    por_vencer = lotes.filter(
        fecha_expiracion__gte=ahora,
        fecha_expiracion__lte=ahora + timedelta(days=30),
    ).aggregate(total=Sum('cantidad_disponible'))['total'] or 0
    fuentes = [
        {
            'origen': fila['origen'],
            'dinamica': fila['dinamica__nombre'] or 'Sin programa',
            'puntos': fila['total'],
        }
        for fila in models.LotePuntos.objects.filter(
            negocio=negocio,
            fecha_otorgamiento__gte=limites_datetime(negocio, rango)[0],
            fecha_otorgamiento__lt=limites_datetime(negocio, rango)[1],
        ).values('origen', 'dinamica__nombre').annotate(
            total=Sum('cantidad_otorgada'),
        ).order_by('-total')[:5]
    ]
    tarjetas = list(models.Dinamica.objects.filter(
        negocio=negocio, tipo='sellos', status=True,
    ).order_by('nombre'))
    en_curso = models.CicloTarjeta.objects.filter(
        negocio=negocio, estado='en_curso',
    )
    completados = models.CicloTarjeta.objects.filter(
        negocio=negocio,
        estado='completado',
        fecha_fin__gte=limites_datetime(negocio, rango)[0],
        fecha_fin__lt=limites_datetime(negocio, rango)[1],
    )
    progreso = en_curso.aggregate(
        sellos=Sum('sellos_actuales'), meta=Sum('meta'), total=Count('id'),
    )
    dinamicas = list(
        models.CicloTarjeta.objects.filter(
            negocio=negocio,
            fecha_inicio__gte=limites_datetime(negocio, rango)[0],
            fecha_inicio__lt=limites_datetime(negocio, rango)[1],
        ).values('dinamica__nombre').annotate(
            ciclos=Count('id'),
            completados=Count('id', filter=Q(estado='completado')),
        ).order_by('-ciclos')[:5]
    )
    return {
        'periodo': _periodo_dict(rango),
        'alcance_sucursal': (
            'negocio' if alcance['seleccionada'] is None
            else 'negocio (puntos, tarjetas y cupones se comparten entre sucursales)'
        ),
        'puntos': {
            'otorgados': por_tipo.get('otorgado', 0) or 0,
            'consumidos': abs(por_tipo.get('consumido', 0) or 0),
            'expirados': abs(por_tipo.get('expirado', 0) or 0),
            'ajustes': por_tipo.get('ajuste', 0) or 0,
            'saldo_actual_total': saldo_total,
            'lotes_con_saldo': lotes.count(),
            'puntos_por_vencer_30_dias': por_vencer,
        },
        'fuentes_de_puntos': fuentes,
        'tarjetas': {
            'activas': len(tarjetas),
            'configuracion': [
                {
                    'nombre': item.nombre,
                    'meta': item.meta,
                    'repetible': item.es_repetible,
                    'inicio': _iso(item.fecha_inicio, negocio),
                    'fin': _iso(item.fecha_fin, negocio),
                }
                for item in tarjetas
            ],
            'ciclos_en_curso': progreso['total'] or 0,
            'sellos_actuales': progreso['sellos'] or 0,
            'meta_acumulada': progreso['meta'] or 0,
            'ciclos_completados_periodo': completados.count(),
            'dinamicas_mas_utilizadas': [
                {
                    'dinamica': fila['dinamica__nombre'],
                    'ciclos_iniciados': fila['ciclos'],
                    'ciclos_completados': fila['completados'],
                }
                for fila in dinamicas
            ],
            'sellos_otorgados': None,
            'nota': (
                'Benefy no guarda un movimiento histórico independiente por '
                'sello. Se muestran el progreso actual, los ciclos completados '
                'y las visitas válidas que los hicieron avanzar.'
            ),
        },
    }


def _recompensas(usuario, negocio, alcance, rango):
    query = models.Recompensa.objects.filter(
        Q(negocio=negocio)
        | Q(alianza__negocio1=negocio)
        | Q(alianza__negocio2=negocio)
    ).select_related('dinamica', 'alianza', 'negocio').distinct()
    cupones = _cupones_qs(negocio, rango) if alcance['es_dueno'] else None
    por_recompensa = {}
    if cupones is not None:
        por_recompensa = {
            fila['recompensa_id']: fila
            for fila in cupones.values('recompensa_id').annotate(
                emitidos=Count('id'),
            )
        }
        canjeados = {
            fila['cupon__recompensa_id']: fila['total']
            for fila in _canjes_qs(negocio, rango, None).filter(
                anulado=False,
            ).values('cupon__recompensa_id').annotate(total=Count('id'))
        }
    else:
        canjeados = {}
    ahora = timezone.now()
    datos = []
    for recompensa in query.order_by('-status', 'titulo'):
        uso = por_recompensa.get(recompensa.pk)
        emitidos = uso['emitidos'] if uso else None
        usados = canjeados.get(recompensa.pk, 0) if alcance['es_dueno'] else None
        pareja = recompensa.alianza
        aliado = None
        if pareja is not None:
            aliado = (
                pareja.negocio2.nombre
                if pareja.negocio1_id == negocio.pk else pareja.negocio1.nombre
            )
        vigente = True
        if recompensa.dinamica_id:
            vigente = (
                recompensa.dinamica.status
                and recompensa.dinamica.fecha_inicio <= ahora
                and (
                    recompensa.dinamica.fecha_fin is None
                    or recompensa.dinamica.fecha_fin >= ahora
                )
            )
        if recompensa.alianza_id:
            vigente = vigente and recompensa.alianza.vigente
        datos.append({
            'titulo': recompensa.titulo,
            'tipo': recompensa.tipo,
            'costo_puntos': recompensa.costo_desbloqueo,
            'es_meta': recompensa.es_meta,
            'status': recompensa.status,
            'disponible': (
                recompensa.status
                and vigente
                and (recompensa.fecha_expiracion is None or recompensa.fecha_expiracion > ahora)
                and (recompensa.cantidad_disponible is None or recompensa.cantidad_disponible > 0)
            ),
            'fecha_expiracion': _iso(recompensa.fecha_expiracion, negocio),
            'vigencia_dias': recompensa.vigencia_dias,
            'stock': recompensa.cantidad_disponible,
            'programa': recompensa.dinamica.nombre if recompensa.dinamica_id else None,
            'alianza': aliado,
            'emitidos_periodo': emitidos,
            'canjeados_periodo': usados,
            'tasa_canje': (
                round(usados / emitidos * 100, 1)
                if emitidos and usados is not None else None
            ),
        })
    activas = [item for item in datos if item['status']]
    return {
        'periodo': _periodo_dict(rango),
        'configuracion_actual': True,
        'alcance_sucursal': (
            'negocio (las recompensas pertenecen al negocio completo)'
        ),
        'total': len(datos),
        'activas': len(activas),
        'resultados': datos[:50],
        'poca_actividad': (
            [
                item['titulo'] for item in activas
                if item['emitidos_periodo'] == 0 and item['alianza'] is None
            ]
            if alcance['es_dueno'] else None
        ),
        'nota_periodo': (
            'La lista y la vigencia de recompensas son la configuración actual. '
            'El periodo solo aplica a las columnas de emitidos y canjeados.'
        ),
        'nota': (
            None if alcance['es_dueno'] else
            'Los datos de uso de recompensas solo están disponibles para el propietario.'
        ),
    }


def _cupones(usuario, negocio, alcance, rango):
    if not alcance['es_dueno']:
        raise PermissionDenied('Solo el propietario puede consultar cupones.')
    cupones = _cupones_qs(negocio, rango)
    ahora = timezone.now()
    vencidos = cupones.filter(
        Q(status='vencido') | Q(status='disponible', fecha_expiracion__lt=ahora),
    ).count()
    disponibles = cupones.filter(
        status='disponible', fecha_expiracion__gte=ahora,
    ).count()
    canjeados = cupones.filter(status='canjeado').count()
    anulados = cupones.filter(status='anulado').count()
    emitidos = cupones.count()
    cohorte = cupones.values('recompensa_id', 'recompensa__titulo').annotate(
        emitidos=Count('id'),
    ).order_by('-emitidos')[:10]
    activida_canjes = _canjes_qs(negocio, rango, None).filter(anulado=False)
    return {
        'periodo': _periodo_dict(rango),
        'alcance_sucursal': (
            'negocio (los cupones pertenecen al negocio y no a una sucursal)'
        ),
        'emitidos': emitidos,
        'disponibles_vigentes': disponibles,
        'canjeados': canjeados,
        'vencidos': vencidos,
        'anulados': anulados,
        'tasa_canje': {
            'porcentaje': round(canjeados / emitidos * 100, 1) if emitidos else None,
            'numerador': canjeados,
            'denominador': emitidos,
            'definicion': 'cupones emitidos en el periodo que ya fueron canjeados',
        },
        'canjes_realizados_en_periodo': activida_canjes.count(),
        'por_recompensa': [
            {'recompensa': fila['recompensa__titulo'], 'emitidos': fila['emitidos']}
            for fila in cohorte
        ],
        'por_origen': [
            {'origen': fila['origen'], 'emitidos': fila['total']}
            for fila in cupones.values('origen').annotate(
                total=Count('id'),
            ).order_by('-total')
        ],
        'proximos_a_vencer': cupones.filter(
            status='disponible',
            fecha_expiracion__gte=ahora,
            fecha_expiracion__lte=ahora + timedelta(days=30),
        ).count(),
        'nota': (
            'La tasa de canje usa como denominador los cupones emitidos en el '
            'periodo. Los canjes realizados en el periodo se informan aparte.'
        ),
    }


def _canjes(usuario, negocio, alcance, rango, limite):
    query = _canjes_qs(negocio, rango, alcance['filtro_sucursales'])
    activos = query.filter(anulado=False)
    por_recompensa = [
        {'recompensa': fila['cupon__titulo_beneficio'] or 'Sin título',
         'canjes': fila['total']}
        for fila in activos.values('cupon__titulo_beneficio').annotate(
            total=Count('id'),
        ).order_by('-total')[:10]
    ]
    por_sucursal = [
        {'sucursal': fila['sucursal__nombre'] or 'QR del negocio',
         'canjes': fila['total']}
        for fila in activos.values('sucursal__nombre').annotate(
            total=Count('id'),
        ).order_by('-total')
    ]
    por_metodo = [
        {'metodo': fila['metodo'], 'canjes': fila['total']}
        for fila in activos.values('metodo').annotate(
            total=Count('id'),
        ).order_by('-total')
    ]
    top = None
    if alcance['es_dueno']:
        filas_top = list(
            activos.values('cupon__usuario_id').annotate(
                total=Count('id'),
            ).order_by('-total')[:limite]
        )
        usuarios = {
            fila['id']: fila
            for fila in models.Usuario.objects.filter(
                pk__in=[fila['cupon__usuario_id'] for fila in filas_top],
            ).values('id', 'nombre', 'apellido')
        }
        top = [
            {
                'nombre': (
                    f"{usuarios[fila['cupon__usuario_id']]['nombre']} "
                    f"{usuarios[fila['cupon__usuario_id']]['apellido']}"
                ).strip(),
                'canjes': fila['total'],
            }
            for fila in filas_top
            if fila['cupon__usuario_id'] in usuarios
        ]
    return {
        'periodo': _periodo_dict(rango),
        'total': query.count(),
        'validos': activos.count(),
        'anulados': query.filter(anulado=True).count(),
        'por_recompensa': por_recompensa,
        'por_sucursal': por_sucursal,
        'por_metodo': por_metodo,
        'top_clientes': top,
        'nota': (
            None if alcance['es_dueno'] else
            'El ranking nominal de clientes solo está disponible para el propietario.'
        ),
    }


def _sucursales(usuario, negocio, alcance, rango):
    filas = []
    if alcance['seleccionada'] is not None:
        sucursales = [alcance['seleccionada']]
    else:
        sucursales = alcance['autorizadas']
    for sucursal in sucursales:
        visitas = _visitas_qs(negocio, rango, [sucursal.pk]).filter(es_valida=True)
        canjes = _canjes_qs(negocio, rango, [sucursal.pk]).filter(anulado=False)
        ultima = visitas.aggregate(ultima=Max('fecha'))['ultima']
        filas.append({
            'nombre': sucursal.nombre,
            'ciudad': sucursal.ciudad,
            'status': sucursal.status,
            'visitas_validas': visitas.count(),
            'clientes_unicos': visitas.values('usuario_id').distinct().count(),
            'canjes': canjes.count(),
            'ultima_actividad': _iso(ultima, negocio),
        })
    if alcance['es_dueno']:
        sin_sucursal = _visitas_qs(negocio, rango, None).filter(
            es_valida=True, sucursal__isnull=True,
        )
        if sin_sucursal.exists():
            filas.append({
                'nombre': 'QR del negocio (sin sucursal)',
                'ciudad': None,
                'status': True,
                'visitas_validas': sin_sucursal.count(),
                'clientes_unicos': sin_sucursal.values('usuario_id').distinct().count(),
                'canjes': 0,
                'ultima_actividad': _iso(
                    sin_sucursal.aggregate(ultima=Max('fecha'))['ultima'], negocio,
                ),
            })
    return {
        'periodo': _periodo_dict(rango),
        'sucursales': filas,
        'nota': (
            None if alcance['es_dueno'] else
            'Solo se muestran las sucursales autorizadas para tu rol.'
        ),
    }


def _equipo(usuario, negocio, alcance):
    query = access.scoped_queryset(
        usuario,
        models.UsuarioNegocio.objects.filter(negocio=negocio),
    ).select_related('usuario', 'sucursal').order_by('usuario__nombre', 'usuario__apellido')
    if alcance['seleccionada'] is not None:
        query = query.filter(
            Q(sucursal=alcance['seleccionada'])
            | Q(rol_comercio='dueno', sucursal__isnull=True),
        )
    miembros = [
        {
            'nombre': f"{item.usuario.nombre} {item.usuario.apellido}".strip(),
            'rol': item.rol_comercio,
            'sucursal': item.sucursal.nombre if item.sucursal_id else 'Todas las sucursales',
            'status': item.status,
            'es_usuario_actual': item.usuario_id == usuario.pk,
        }
        for item in query
    ]
    invitaciones = models.InvitacionMembresia.objects.filter(
        negocio=negocio, estado='pendiente',
    )
    if not alcance['es_dueno']:
        branches = {item.pk for item in alcance['autorizadas']}
        invitaciones = invitaciones.filter(sucursal_id__in=branches)
    return {
        'miembros': miembros,
        'total_visibles': len(miembros),
        'activos': sum(item['status'] for item in miembros),
        'por_rol': {
            rol: sum(item['rol'] == rol for item in miembros)
            for rol in ('dueno', 'supervisor', 'empleado')
        },
        'invitaciones_pendientes': invitaciones.count(),
        'nota': (
            'El listado respeta el alcance del rol; un empleado solo ve su propia '
            'membresía y un supervisor las de sus sucursales.'
        ),
    }


def _alianzas(usuario, negocio, alcance, estado, limite):
    query = models.Alianza.objects.filter(
        Q(negocio1=negocio) | Q(negocio2=negocio),
    ).select_related('negocio1', 'negocio2').prefetch_related('recompensas')
    if estado:
        if estado not in ESTADOS_ALIANZA:
            raise ErrorConsulta(
                'Estado no válido. Usa: ' + ', '.join(ESTADOS_ALIANZA) + '.'
            )
        query = query.filter(status=estado)
    ahora = timezone.now()
    filas = []
    for item in query.order_by('-fecha_solicitud')[:limite]:
        pareja = item.negocio2 if item.negocio1_id == negocio.pk else item.negocio1
        filas.append({
            'id': item.pk,
            'aliado': pareja.nombre,
            'direccion': 'enviada' if item.negocio1_id == negocio.pk else 'recibida',
            'estado': item.status,
            'vigente': item.vigente,
            'fecha_inicio': _iso(item.fecha_inicio, negocio),
            'fecha_fin': _iso(item.fecha_fin, negocio),
            'dias_restantes': (
                max((item.fecha_fin - ahora).days, 0)
                if item.status == 'activa' and item.fecha_fin > ahora else None
            ),
            'condicion': item.condicion_participacion,
            'recompensas': [
                {
                    'titulo': recompensa.titulo,
                    'tipo': recompensa.tipo,
                    'costo_puntos': recompensa.costo_desbloqueo,
                    'status': recompensa.status,
                    'descripcion': recompensa.descripcion,
                }
                for recompensa in item.recompensas.all()[:10]
            ],
        })
    activas = query.filter(status='activa').count()
    proxima = min(
        (
            fila for fila in filas
            if fila['estado'] == 'activa' and fila['fecha_fin']
        ),
        key=lambda fila: fila['fecha_fin'],
        default=None,
    )
    return {
        'total': query.count(),
        'activas': activas,
        'resultados': filas,
        'proxima_a_vencer': proxima,
        'nota': (
            'Una alianza activa solo está vigente dentro de sus fechas de inicio '
            'y fin. Las recompensas compartidas pertenecen al negocio que las ofrece.'
        ),
    }


def _plan(negocio):
    datos = planes.resumen_plan(negocio)
    datos['plan']['nombre_visible'] = {
        'free': 'Plan gratis',
        'premium': 'Plan premium',
    }.get(datos['plan']['codigo'], datos['plan']['nombre'])
    return datos


def _negocio(negocio, alcance):
    return {
        'id': negocio.pk,
        'nombre': negocio.nombre,
        'descripcion': negocio.descripcion,
        'zona_horaria': negocio.zona_horaria,
        'categoria': negocio.categoria.nombre if negocio.categoria_id else None,
        'sucursales': [
            {'id': item.pk, 'nombre': item.nombre}
            for item in alcance['autorizadas']
        ],
    }


def consultar(
    usuario,
    negocio,
    tema,
    *,
    periodo=None,
    desde=None,
    hasta=None,
    sucursal_id=None,
    comparar=False,
    orden='visitas',
    limite=10,
    incluir_inactivos=False,
    estado=None,
    ahora=None,
):
    """Punto de entrada único de la analítica autorizada de Benef AI."""
    if tema not in TEMAS:
        raise ErrorConsulta('Tema no válido. Usa: ' + ', '.join(TEMAS) + '.')
    alcance = _alcance(usuario, negocio, sucursal_id)
    if tema == 'plan':
        return _plan(negocio)
    if tema == 'negocio':
        return _negocio(negocio, alcance)
    if tema == 'equipo':
        return _equipo(usuario, negocio, alcance)
    if limite is None:
        limite = 10
    limite = min(max(int(limite), 1), MAX_RESULTADOS)
    rango = _rango(negocio, periodo, desde, hasta, ahora)
    if tema == 'resumen':
        return _resumen(usuario, negocio, alcance, rango, comparar)
    if tema == 'visitas':
        return _visitas(usuario, negocio, alcance, rango, comparar, limite)
    if tema == 'clientes':
        return _clientes(
            usuario, negocio, alcance, rango, orden, limite, incluir_inactivos,
        )
    if tema == 'puntos':
        return _puntos(usuario, negocio, alcance, rango)
    if tema == 'tarjetas':
        return _puntos(usuario, negocio, alcance, rango)
    if tema == 'recompensas':
        return _recompensas(usuario, negocio, alcance, rango)
    if tema == 'cupones':
        return _cupones(usuario, negocio, alcance, rango)
    if tema == 'canjes':
        return _canjes(usuario, negocio, alcance, rango, limite)
    if tema == 'sucursales':
        return _sucursales(usuario, negocio, alcance, rango)
    if tema == 'alianzas':
        return _alianzas(usuario, negocio, alcance, estado, limite)
    raise ErrorConsulta('Tema no implementado.')
