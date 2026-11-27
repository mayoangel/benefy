"""Periodos y contexto temporal confiables para Benef AI.

Todas las fechas relativas se calculan con la zona horaria del negocio y con un
reloj inyectable para poder probarlas con fechas congeladas.
"""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.utils import timezone

from core.utils.tiempo import zona_del_negocio

MAX_DIAS_CONSULTA = 366

PERIODOS = (
    'hoy',
    'ayer',
    'esta_semana',
    'semana_pasada',
    'este_mes',
    'mes_pasado',
    'ultimos_7_dias',
    'ultimos_30_dias',
    'ultimos_90_dias',
    'ano_actual',
)

NOMBRES_PERIODO = {
    'hoy': 'hoy',
    'ayer': 'ayer',
    'esta_semana': 'esta semana',
    'semana_pasada': 'la semana pasada',
    'este_mes': 'este mes',
    'mes_pasado': 'el mes pasado',
    'ultimos_7_dias': 'los últimos 7 días',
    'ultimos_30_dias': 'los últimos 30 días',
    'ultimos_90_dias': 'los últimos 90 días',
    'ano_actual': 'este año',
}

MESES = (
    'ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
)


class ErrorPeriodo(ValueError):
    """El periodo solicitado no es válido o excede el límite permitido."""


@dataclass(frozen=True)
class Rango:
    clave: str
    nombre: str
    desde: date
    hasta: date

    @property
    def dias(self) -> int:
        return (self.hasta - self.desde).days + 1

    @property
    def anterior(self) -> 'Rango':
        dias = self.dias
        hasta = self.desde - timedelta(days=1)
        desde = hasta - timedelta(days=dias - 1)
        return Rango(
            clave=f'{self.clave}_anterior',
            nombre=f'periodo anterior a {self.nombre}',
            desde=desde,
            hasta=hasta,
        )

    def etiqueta(self) -> str:
        return f'{_fecha_corta(self.desde)} – {_fecha_corta(self.hasta)}'

    def como_dict(self) -> dict:
        anterior = self.anterior
        return {
            'clave': self.clave,
            'nombre': self.nombre,
            'desde': self.desde.isoformat(),
            'hasta': self.hasta.isoformat(),
            'dias': self.dias,
            'etiqueta': self.etiqueta(),
            'anterior': {
                'desde': anterior.desde.isoformat(),
                'hasta': anterior.hasta.isoformat(),
                'etiqueta': anterior.etiqueta(),
            },
        }


def _fecha_corta(valor: date) -> str:
    return f'{valor.day} {MESES[valor.month - 1]} {valor.year}'


def ahora_local(negocio, ahora=None) -> datetime:
    momento = ahora or timezone.now()
    if timezone.is_naive(momento):
        momento = timezone.make_aware(momento, timezone.utc)
    return momento.astimezone(zona_del_negocio(negocio))


def _rango(clave, desde, hasta) -> Rango:
    return Rango(
        clave=clave,
        nombre=NOMBRES_PERIODO[clave],
        desde=desde,
        hasta=hasta,
    )


def _periodo_relativo(clave, hoy: date) -> Rango:
    if clave == 'hoy':
        return _rango(clave, hoy, hoy)
    if clave == 'ayer':
        ayer = hoy - timedelta(days=1)
        return _rango(clave, ayer, ayer)
    if clave == 'esta_semana':
        inicio = hoy - timedelta(days=hoy.weekday())
        return _rango(clave, inicio, hoy)
    if clave == 'semana_pasada':
        inicio_actual = hoy - timedelta(days=hoy.weekday())
        inicio = inicio_actual - timedelta(days=7)
        return _rango(clave, inicio, inicio + timedelta(days=6))
    if clave == 'este_mes':
        return _rango(clave, hoy.replace(day=1), hoy)
    if clave == 'mes_pasado':
        fin = hoy.replace(day=1) - timedelta(days=1)
        return _rango(clave, fin.replace(day=1), fin)
    if clave == 'ultimos_7_dias':
        return _rango(clave, hoy - timedelta(days=6), hoy)
    if clave == 'ultimos_30_dias':
        return _rango(clave, hoy - timedelta(days=29), hoy)
    if clave == 'ultimos_90_dias':
        return _rango(clave, hoy - timedelta(days=89), hoy)
    if clave == 'ano_actual':
        return _rango(clave, date(hoy.year, 1, 1), hoy)
    raise ErrorPeriodo('El periodo indicado no es válido.')


def _parse_fecha(valor, campo):
    if valor in (None, ''):
        return None
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    try:
        return date.fromisoformat(str(valor))
    except ValueError:
        raise ErrorPeriodo(f'{campo} debe usar el formato ISO YYYY-MM-DD.') from None


def resolver_rango(
    negocio,
    *,
    periodo=None,
    desde=None,
    hasta=None,
    ahora=None,
    por_defecto='ultimos_30_dias',
) -> Rango:
    """Resuelve un periodo relativo o un rango explícito en fecha local."""
    hoy = ahora_local(negocio, ahora).date()
    periodo = (periodo or '').strip() or None
    desde_fecha = _parse_fecha(desde, 'desde')
    hasta_fecha = _parse_fecha(hasta, 'hasta')
    if periodo and (desde_fecha or hasta_fecha):
        raise ErrorPeriodo('Usa un periodo relativo o fechas explícitas, no ambos.')
    if periodo:
        if periodo not in PERIODOS:
            raise ErrorPeriodo(
                'Periodo no válido. Usa uno de: ' + ', '.join(PERIODOS) + '.'
            )
        return _periodo_relativo(periodo, hoy)
    if desde_fecha is None and hasta_fecha is None:
        return _periodo_relativo(por_defecto, hoy)
    if desde_fecha is None or hasta_fecha is None:
        raise ErrorPeriodo('Indica desde y hasta juntos en formato YYYY-MM-DD.')
    if desde_fecha > hasta_fecha:
        raise ErrorPeriodo('La fecha inicial no puede ser posterior a la final.')
    if hasta_fecha > hoy:
        raise ErrorPeriodo('No hay datos posteriores a la fecha actual del negocio.')
    if (hasta_fecha - desde_fecha).days + 1 > MAX_DIAS_CONSULTA:
        raise ErrorPeriodo(
            f'El rango máximo para una consulta es de {MAX_DIAS_CONSULTA} días.'
        )
    return Rango(
        clave='personalizado',
        nombre='periodo personalizado',
        desde=desde_fecha,
        hasta=hasta_fecha,
    )


def contexto_temporal(negocio, ahora=None) -> dict:
    local = ahora_local(negocio, ahora)
    hoy = local.date()
    periodos = {
        clave: _periodo_relativo(clave, hoy).como_dict()
        for clave in PERIODOS
    }
    return {
        'ahora': local.isoformat(),
        'fecha_actual': hoy.isoformat(),
        'zona_horaria': str(zona_del_negocio(negocio)),
        'inicio_semana': 'lunes',
        'periodos': periodos,
        'nota': (
            'Estas fechas fueron calculadas por Django con la zona horaria del '
            'negocio. No calcules fechas relativas por tu cuenta.'
        ),
    }


def limites_datetime(negocio, rango: Rango) -> tuple[datetime, datetime]:
    """Inicio inclusivo y fin exclusivo en la zona horaria del negocio."""
    zona: ZoneInfo = zona_del_negocio(negocio)
    inicio = datetime.combine(rango.desde, time.min, tzinfo=zona)
    fin = datetime.combine(rango.hasta + timedelta(days=1), time.min, tzinfo=zona)
    return inicio, fin
