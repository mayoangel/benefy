import { Link } from 'react-router-dom';
import Icon, { type IconName } from '../../components/Icon';
import Card from '../components/Card';
import StatusBadge from '../components/StatusBadge';
import { number } from '../data/format';

interface Point { mes: string; total: number }
export interface OverviewData {
  metricas: Record<string, number>;
  series: Record<string, Point[]>;
  incidenciasAbiertas: number;
}

const metrics: { key: string; label: string; icon: IconName; path: string; period?: boolean }[] = [
  { key: 'comerciosActivos', label: 'Comercios activos', icon: 'storefront', path: 'comercios' },
  { key: 'comerciosSuspendidos', label: 'Comercios suspendidos', icon: 'lock', path: 'comercios' },
  { key: 'consumidores', label: 'Consumidores registrados', icon: 'person', path: 'consumidores' },
  { key: 'visitas', label: 'Visitas totales', icon: 'monitoring', path: 'comercios', period: true },
  { key: 'canjes', label: 'Canjes totales', icon: 'confirmation_number', path: 'auditoria', period: true },
  { key: 'suscripcionesActivas', label: 'Suscripciones activas', icon: 'receipt_long', path: 'suscripciones' },
  { key: 'pagosPendientes', label: 'Pagos pendientes', icon: 'notifications', path: 'suscripciones' },
];

function ActivityChart({ series }: { series: { label: string; points: Point[] }[] }) {
  const monthFormat = new Intl.DateTimeFormat('es-MX', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  const months = [...new Set(series.flatMap(item => item.points.map(point => point.mes)))].sort();
  const values = series.map(item => new Map(item.points.map(point => [point.mes, point.total])));
  const max = Math.max(1, ...series.flatMap(item => item.points.map(point => point.total)));
  if (!months.length) return <p className="bd-muted">Sin actividad en el periodo seleccionado.</p>;
  return <div className="bd-platform-chart">
    {months.map(month => <div key={month}>
      <b>{monthFormat.format(new Date(month))}</b>
      {series.map((item, index) => {
        const value = values[index].get(month) || 0;
        return <div className="bd-platform-bar-row" key={item.label}>
          <span>{item.label}</span>
          <div className="bd-platform-track" aria-hidden="true">
            <div className={index ? 'bd-platform-bar alternate' : 'bd-platform-bar'} style={{ width: `${value / max * 100}%` }} />
          </div>
          <strong>{number(value)}</strong>
        </div>;
      })}
    </div>)}
  </div>;
}

export default function PlatformOverview({ data }: { data: OverviewData }) {
  return <div className="bd-platform-stack">
    <div className="bd-metrics">
      {metrics.map(item => <Link key={item.key} className="bd-card bd-metric" to={`/administracion/${item.path}`}>
        <div><span>{item.label}</span><Icon name={item.icon} /></div>
        <strong>{number(data.metricas[item.key])}</strong>
        <span className="bd-metric-period">{item.period ? 'Periodo seleccionado' : 'Estado actual'}</span>
      </Link>)}
    </div>
    <div className="bd-grid">
      <Card title="Crecimiento mensual">
        <ActivityChart series={[{ label: 'Comercios', points: data.series.comercios },
          { label: 'Consumidores', points: data.series.consumidores }]} />
      </Card>
      <Card title="Actividad global mensual">
        <ActivityChart series={[{ label: 'Visitas', points: data.series.visitas },
          { label: 'Canjes', points: data.series.canjes }]} />
      </Card>
    </div>
    <Card title="Alertas de la plataforma">
      <div className="bd-form-actions">
        <Link className="bd-secondary" to="/administracion/incidencias?estado=abierta">Incidencias abiertas <StatusBadge tone={data.incidenciasAbiertas ? 'warning' : 'neutral'}>{data.incidenciasAbiertas}</StatusBadge></Link>
        <Link className="bd-secondary" to="/administracion/suscripciones?estado=Pago%20pendiente">Suscripciones con pago pendiente <StatusBadge tone={data.metricas.pagosPendientes ? 'warning' : 'neutral'}>{data.metricas.pagosPendientes}</StatusBadge></Link>
      </div>
    </Card>
  </div>;
}
