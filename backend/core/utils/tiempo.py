"""Cálculo de fechas locales a partir de la zona horaria del negocio."""

from datetime import date, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.utils import timezone

ZONA_HORARIA_POR_DEFECTO = "America/Tijuana"


def ahora_utc() -> datetime:
    """Devuelve la hora actual en UTC, con zona horaria."""
    return timezone.now()


def zona_del_negocio(negocio) -> ZoneInfo:
    """Resuelve la zona horaria configurada, con respaldo seguro."""
    nombre = getattr(negocio, "zona_horaria", None) or ZONA_HORARIA_POR_DEFECTO
    try:
        return ZoneInfo(nombre)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo(ZONA_HORARIA_POR_DEFECTO)


def fecha_negocio(negocio, momento: datetime | None = None) -> date:
    """Convierte un instante UTC a la fecha local del negocio."""
    momento = momento or ahora_utc()
    if timezone.is_naive(momento):
        momento = timezone.make_aware(momento, timezone.utc)
    return momento.astimezone(zona_del_negocio(negocio)).date()
