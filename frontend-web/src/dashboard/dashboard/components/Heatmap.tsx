import Card from './Card';
import { useDemoData } from '../data/DemoDataProvider';
import { periodScale } from '../data/period';
import { number } from '../data/format';
export default function Heatmap() {
  const { period } = useDemoData();
  const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const times = ['08–11 h', '11–14 h', '14–17 h', '17–20 h'];
  return <Card title="Días pico">
    <p className="bd-muted">Visitas por día de la semana y franja horaria. Datos de ejemplo.</p>
    <div className="bd-heatmap" role="img" aria-label="Mapa de actividad. La mayor participación ocurre el sábado por la tarde. La tabla alternativa detalla las visitas.">
      <span />{times.map(time => <span key={time}>{time}</span>)}{days.map((day, d) => <div className="bd-heatmap-row" key={day}>
        <span>{day}</span>{times.map((time, t) => { const level = (d * 3 + t * 2) % 5; return <span key={time} className={`bd-heat-level-${level}`} title={`${day} ${time}: ${number((level + 1) * 14 * periodScale(period))} visitas`}>{number((level + 1) * 14 * periodScale(period))}</span>; })}</div>)}</div>
    <p className="bd-muted">Menor actividad <span aria-hidden="true"> ░ ▒ ▓ █ </span> Mayor actividad</p>
    <table className="bd-sr-only">
      <caption>Visitas por día y franja horaria</caption>
      <thead>
        <tr>
          <th>Día</th>{times.map(t => <th key={t}>{t}</th>)}</tr>
      </thead>
      <tbody>{days.map((day, d) => <tr key={day}>
        <th>{day}</th>{times.map((t, i) => <td key={t}>{number(((d * 3 + i * 2) % 5 + 1) * 14 * periodScale(period))}</td>)}</tr>)}</tbody>
    </table>
  </Card>;
}
