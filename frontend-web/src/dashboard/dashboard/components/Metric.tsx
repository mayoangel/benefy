import { Link } from 'react-router-dom';
import Icon, { type IconName } from '../../components/Icon';
import { useDemoData } from '../data/DemoDataProvider';
import { periodScale, periodLabel } from '../data/period';
import { number } from '../data/format';
type MetricItem = { label: string; value: number; delta: number; icon: IconName; to: string; percent?: boolean };
export const metrics: MetricItem[] = [
  { label: 'Clientes activos', value: 1284, delta: 12.8, icon: 'person', to: '/negocio/clientes' },
  { label: 'Visitas registradas', value: 3642, delta: 18.4, icon: 'storefront', to: '/negocio/clientes' },
  { label: 'Recompensas canjeadas', value: 186, delta: -3, icon: 'confirmation_number', to: '/negocio/dinamicas' },
  { label: 'Tasa de retorno', value: 42.6, delta: 4.1, icon: 'sync_alt', to: '/negocio/clientes', percent: true },
];
export default function Metrics({ items = metrics }: { items?: MetricItem[] }) {
  const { period } = useDemoData();
  return <div className="bd-metrics">{items.map((item, index) => <Link className="bd-card bd-metric" to={item.to} key={item.label}>
    <div>
      <span>{item.label}</span>
      <Icon name={item.icon} />
    </div>
    <strong>{number(item.value * (item.percent ? 1 : periodScale(period)), item.percent ? 1 : 0)}{item.percent ? ' %' : ''}</strong>
    <div className="bd-metric-bottom">
      <small className={item.delta < 0 ? 'bd-delta-negative' : 'bd-delta-positive'}>
        <span aria-hidden="true">{item.delta < 0 ? '▼' : '▲'}</span> {item.delta < 0 ? '−' : '+'}{number(Math.abs(item.delta), 1)} %<span className="bd-sr-only">{item.delta < 0 ? 'Disminución' : 'Aumento'} respecto al periodo anterior</span>
      </small>
      <svg viewBox="0 0 100 32" width="90" height="32" aria-hidden="true">
        <polyline fill="none" stroke="currentColor" strokeWidth="2" points={item.delta < 0 ? '0,5 16,12 33,8 50,20 66,17 82,25 100,30' : `0,28 16,20 33,24 50,${14 + index} 66,16 82,6 100,2`} />
      </svg>
    </div>
    <span className="bd-metric-period">{periodLabel(period)}</span>
  </Link>)}</div>;
}
