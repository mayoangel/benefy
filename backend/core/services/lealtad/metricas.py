"""Métricas básicas del panel del negocio."""

from datetime import datetime, time, timedelta

from django.db.models import Count, Sum

from core import models
from core.utils.tiempo import zona_del_negocio


def metricas_negocio(negocio, desde, hasta, sucursales=None, incluir_totales=True):
    """Métricas del negocio o de una o varias sucursales.

    Los puntos, la emisión de cupones y los ciclos no tienen sucursal propia;
    para un alcance por sucursal se devuelven como ``None`` para no mezclar
    datos de todo el negocio.
    """
    zona = zona_del_negocio(negocio)
    inicio = datetime.combine(desde, time.min, tzinfo=zona)
    fin = datetime.combine(hasta + timedelta(days=1), time.min, tzinfo=zona)

    visitas = models.RegistroActividad.objects.filter(
        negocio=negocio,
        tipo='visita',
        es_valida=True,
        fecha_negocio__range=(desde, hasta),
    )
    canjes = models.Canje.objects.filter(
        negocio=negocio,
        fecha__gte=inicio,
        fecha__lt=fin,
    )
    if sucursales is not None:
        visitas = visitas.filter(sucursal__in=sucursales)
        canjes = canjes.filter(sucursal__in=sucursales)

    if incluir_totales:
        movimientos = models.MovimientoPuntos.objects.filter(
            negocio=negocio,
            fecha__gte=inicio,
            fecha__lt=fin,
        )
        cupones = models.CuponUsuario.objects.filter(
            negocio=negocio,
            fecha_emision__gte=inicio,
            fecha_emision__lt=fin,
        )
        ciclos = models.CicloTarjeta.objects.filter(
            negocio=negocio,
            estado='completado',
            fecha_fin__gte=inicio,
            fecha_fin__lt=fin,
        )
        top = cupones.values('titulo_beneficio').annotate(
            total=Count('id'),
        ).order_by('-total')[:5]
        puntos_otorgados = movimientos.filter(tipo='otorgado').aggregate(
            total=Sum('cantidad'),
        )['total'] or 0
        puntos_consumidos = abs(movimientos.filter(tipo='consumido').aggregate(
            total=Sum('cantidad'),
        )['total'] or 0)
        cupones_emitidos = cupones.count()
        tarjetas_completadas = ciclos.count()
        top_recompensas = [
            {'titulo': fila['titulo_beneficio'] or 'Sin título', 'total': fila['total']}
            for fila in top
        ]
    else:
        puntos_otorgados = None
        puntos_consumidos = None
        cupones_emitidos = None
        tarjetas_completadas = None
        top_recompensas = []

    return {
        'desde': desde.isoformat(),
        'hasta': hasta.isoformat(),
        'alcance': 'negocio' if incluir_totales else 'sucursal',
        'sucursales': [sucursal.pk for sucursal in sucursales] if sucursales is not None else [],
        'visitas_validas': visitas.count(),
        'clientes_unicos': visitas.values('usuario').distinct().count(),
        'puntos_otorgados': puntos_otorgados,
        'puntos_consumidos': puntos_consumidos,
        'cupones_emitidos': cupones_emitidos,
        'cupones_canjeados': canjes.count(),
        'tarjetas_completadas': tarjetas_completadas,
        'top_recompensas': top_recompensas,
    }
