import type {
  Cupon,
  HistorialResultado,
  RecompensaCatalogo,
  SaldoPuntos,
  Tarjeta,
} from './api';

export type WalletBusiness = {
  id: number;
  nombre: string;
  logo_url: string | null;
  puntos: number;
  tarjeta?: Tarjeta;
};

export function negociosBilletera(
  saldos: SaldoPuntos[],
  tarjetas: Tarjeta[],
): WalletBusiness[] {
  const mapa = new Map<number, WalletBusiness>();
  for (const saldo of saldos) {
    mapa.set(saldo.negocio, {
      id: saldo.negocio,
      nombre: saldo.negocio_nombre || `Negocio #${saldo.negocio}`,
      logo_url: saldo.negocio_logo_url,
      puntos: saldo.saldo_actual,
    });
  }
  for (const tarjeta of tarjetas) {
    const actual = mapa.get(tarjeta.negocio);
    mapa.set(tarjeta.negocio, {
      id: tarjeta.negocio,
      nombre: actual?.nombre || tarjeta.negocio_nombre || `Negocio #${tarjeta.negocio}`,
      logo_url: actual?.logo_url ?? tarjeta.negocio_logo_url,
      puntos: actual?.puntos ?? 0,
      tarjeta: actual?.tarjeta ?? tarjeta,
    });
  }
  return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export function estadoRecompensa(
  recompensa: RecompensaCatalogo,
  puntos: number,
  ahora = Date.now(),
): string {
  if (recompensa.fecha_expiracion) {
    const expiracion = Date.parse(recompensa.fecha_expiracion);
    if (!Number.isNaN(expiracion) && expiracion < ahora) return 'Vencida';
  }
  if (recompensa.cantidad_disponible === 0) return 'Agotada';
  if (puntos < recompensa.costo_desbloqueo) {
    return `Te faltan ${recompensa.costo_desbloqueo - puntos} puntos`;
  }
  return 'Disponible';
}

export function estadoCupon(cupon: Cupon, ahora = Date.now()): string {
  const expiracion = Date.parse(cupon.fecha_expiracion);
  if (cupon.status === 'disponible') {
    return !Number.isNaN(expiracion) && expiracion < ahora ? 'Vencido' : 'Disponible';
  }
  if (cupon.status === 'canjeado') return 'Canjeado';
  if (cupon.status === 'anulado') return 'Anulado';
  return 'Vencido';
}

export function cuponDisponible(cupon: Cupon, ahora = Date.now()): boolean {
  return estadoCupon(cupon, ahora) === 'Disponible';
}

export function formatearFecha(value: string | number): string {
  const fecha = new Date(value);
  return Number.isNaN(fecha.getTime())
    ? 'Fecha no disponible'
    : fecha.toLocaleDateString('es-MX');
}

export function nombreNegocio(cupon: Cupon): string {
  return cupon.negocio_nombre || 'Comercio Benefy';
}

export type HistoryItem = {
  id: string;
  kind: string;
  detail: string;
  date: string;
  business: string;
  icon: 'storefront' | 'stars' | 'receipt-long' | 'redeem';
};

export function historialItems(data: HistorialResultado): HistoryItem[] {
  const items: HistoryItem[] = [];
  for (const visita of data.visitas) {
    items.push({
      id: `v-${visita.id}`,
      kind: 'Visita registrada',
      detail: visita.sucursal_nombre || 'Visita válida',
      date: visita.fecha,
      business: visita.negocio_nombre || 'Comercio Benefy',
      icon: 'storefront',
    });
  }
  for (const movimiento of data.movimientos) {
    const etiquetas: Record<string, string> = {
      otorgado: 'Puntos ganados',
      consumido: 'Puntos utilizados',
      expirado: 'Puntos vencidos',
      ajuste: 'Ajuste de puntos',
    };
    items.push({
      id: `m-${movimiento.id}`,
      kind: etiquetas[movimiento.tipo] || 'Movimiento de puntos',
      detail: `${movimiento.cantidad > 0 ? '+' : ''}${movimiento.cantidad} puntos${
        movimiento.descripcion ? ` · ${movimiento.descripcion}` : ''
      }`,
      date: movimiento.fecha,
      business: movimiento.negocio_nombre || 'Comercio Benefy',
      icon: 'stars',
    });
  }
  for (const canje of data.canjes) {
    items.push({
      id: `c-${canje.id}`,
      kind: canje.anulado ? 'Canje anulado' : 'Canje',
      detail: canje.sucursal_nombre || 'Validado en comercio',
      date: canje.fecha,
      business: canje.negocio_nombre || 'Comercio Benefy',
      icon: 'receipt-long',
    });
  }
  return items.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}
