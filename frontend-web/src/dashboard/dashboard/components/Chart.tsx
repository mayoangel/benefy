import { useEffect, useId, useRef, useState } from 'react';
import Card from './Card';
import { useDemoData } from '../data/DemoDataProvider';
import { number } from '../data/format';
import { periodDays, periodLabel, periodScale } from '../data/period';
export default function Chart({ clients = false }: { clients?: boolean }) {
  const { period } = useDemoData();
  const [active, setActive] = useState<number | null>(null);
  const id = useId();
  const [width, setWidth] = useState(640);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const days = periodDays(period);
  const compact = width < 480;
  const baseLabels = days === 1 ? ['08 h', '10 h', '12 h', '14 h', '16 h', '18 h', '20 h'] : days <= 7 ? ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] : ['Tramo 1', 'Tramo 2', 'Tramo 3', 'Tramo 4', 'Tramo 5', 'Tramo 6', 'Tramo 7'];
  const weights = [38, 55, 43, 73, 62, 90, 78];
  const total = Math.round((clients ? 1284 : 3642) * periodScale(period));
  const raw = weights.map(value => Math.floor(value / 439 * total));
  raw[raw.length - 1] += total - raw.reduce((sum, value) => sum + value, 0);
  const values = compact ? [raw[0] + raw[1], raw[2] + raw[3], raw[4] + raw[5], raw[6]] : raw;
  const labels = compact ? (days === 1 ? ['08–10 h', '12–14 h', '16–18 h', '20 h'] : days <= 7 ? ['Lun–Mar', 'Mié–Jue', 'Vie–Sáb', 'Dom'] : ['Tramo 1', 'Tramo 2', 'Tramo 3', 'Tramo 4']) : baseLabels;
  const columnWidth = (width - 64) / values.length;
  const barWidth = Math.min(44, columnWidth - 12);
  const max = Math.ceil(Math.max(...values) / 4) * 4 || 4;
  return <Card title={clients ? 'Evolución de clientes activos' : 'Actividad de tu negocio'}>
    <p className="bd-muted">{periodLabel(period)} · {clients ? 'Clientes con al menos una visita.' : 'Visitas en todas tus sucursales.'}</p>
    <div className="bd-svg-chart" ref={container}>
      <svg viewBox={`0 0 ${width} 300`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
        <title id={`${id}-title`}>{clients ? 'Clientes activos' : 'Visitas registradas'}</title>
        <desc id={`${id}-desc`}>Datos de ejemplo del periodo seleccionado. Usa Tab para consultar cada barra. La tabla siguiente contiene los mismos valores. En móvil se agrupan los intervalos consecutivos.</desc>{[0, 1, 2, 3, 4].map(tick => <g key={tick}>
          <line x1="52" x2={width - 8} y1={240 - tick * 52} y2={240 - tick * 52} stroke="#e4e9ec" />
          <text x="44" y={244 - tick * 52} textAnchor="end">{new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 }).format(max * tick / 4)}</text>
        </g>)}{values.map((value, index) => {
          const height = value / max * 208; const x = 56 + index * columnWidth + (columnWidth - barWidth) / 2;
          return <g key={labels[index]}>
            <rect x={x} y={240 - height} width={barWidth} height={height} rx="6" tabIndex={0} aria-label={`${labels[index]}: ${number(value)}`} onFocus={() => setActive(index)} onBlur={() => setActive(null)} onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)} onTouchStart={() => setActive(index)} onKeyDown={e => { if (e.key === 'Escape') setActive(null); }} className="bd-chart-bar">
              <title>{labels[index]}: {number(value)}</title>
            </rect>
            <text x={x + barWidth / 2} y="268" textAnchor="middle">{labels[index]}</text>{active === index && <g aria-hidden="true">
              <rect x={Math.max(0, Math.min(x - 10, width - 96))} y={Math.max(2, 202 - height)} width="96" height="30" rx="6" fill="#123946" />
              <text x={Math.max(0, Math.min(x - 10, width - 96)) + 48} y={Math.max(22, 222 - height)} textAnchor="middle" fill="white">{number(value)}</text>
            </g>}</g>;
        })}</svg>
    </div>
    <table className="bd-sr-only">
      <caption>{clients ? 'Clientes activos' : 'Visitas'} · {periodLabel(period)}</caption>
      <thead>
        <tr>
          <th>Intervalo</th>
          <th>Cantidad</th>
        </tr>
      </thead>
      <tbody>{values.map((value, i) => <tr key={i}>
        <th>{labels[i]}</th>
        <td>{number(value)}</td>
      </tr>)}</tbody>
    </table>
    <p className="bd-muted">Datos de ejemplo · Cada barra se puede enfocar con el teclado.</p>
  </Card>;
}
