"""Métricas básicas del panel del negocio."""

from django.db.models import Count, Sum

from core import models


def metricas_negocio(negocio, desde, hasta):
    visitas = models.RegistroActividad.objects.filter(
        negocio=negocio,
        tipo='visita',
        es_valida=True,
        fecha_negocio__range=(desde, hasta),
    )
    movimientos = models.MovimientoPuntos.objects.filter(
        negocio=negocio,
        fecha__date__range=(desde, hasta),
    )
    cupones = models.CuponUsuario.objects.filter(
        negocio=negocio,
        fecha_emision__date__range=(desde, hasta),
    )
    canjes = models.Canje.objects.filter(
        negocio=negocio,
        fecha__date__range=(desde, hasta),
    )
    ciclos = models.CicloTarjeta.objects.filter(
        negocio=negocio,
        estado='completado',
        fecha_fin__date__range=(desde, hasta),
    )
    top = cupones.values('titulo_beneficio').annotate(
        total=Count('id'),
    ).order_by('-total')[:5]

    return {
        'desde': desde.isoformat(),
        'hasta': hasta.isoformat(),
        'visitas_validas': visitas.count(),
        'clientes_unicos': visitas.values('usuario').distinct().count(),
        'puntos_otorgados': movimientos.filter(tipo='otorgado').aggregate(
            total=Sum('cantidad'),
        )['total'] or 0,
        'puntos_consumidos': abs(movimientos.filter(tipo='consumido').aggregate(
            total=Sum('cantidad'),
        )['total'] or 0),
        'cupones_emitidos': cupones.count(),
        'cupones_canjeados': canjes.count(),
        'tarjetas_completadas': ciclos.count(),
        'top_recompensas': [
            {'titulo': fila['titulo_beneficio'] or 'Sin título', 'total': fila['total']}
            for fila in top
        ],
    }
