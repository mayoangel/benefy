import { Link } from 'react-router-dom';
import Card from '../components/Card';
import Metrics from '../components/Metric';
import Chart from '../components/Chart';
import Heatmap from '../components/Heatmap';
import StatusBadge from '../components/StatusBadge';
import { useDemoData } from '../data/DemoDataProvider';
import { number, today } from '../data/format';
export default function Overview() {
  const { branches, employees, dynamics, qrDownloaded } = useDemoData();
  const tasks = [{ done: branches.some(b => !b.archived), label: 'Registrar sucursal', to: '/negocio/sucursales' }, { done: dynamics.length > 0, label: 'Crear primera dinámica', to: '/negocio/dinamicas' }, { done: qrDownloaded.length > 0, label: 'Descargar QR', to: '/negocio/sucursales' }, { done: employees.length > 0, label: 'Agregar empleado', to: '/negocio/sucursales' }];
  const expiring = dynamics.filter(d => d.active && d.end >= today() && (new Date(d.end).getTime() - new Date(today()).getTime()) <= 7 * 86400000);
  const completed = tasks.filter(task => task.done).length;
  return <>
    <Metrics />
    <Card title="Requiere tu atención">
      <div className="bd-attention">
        <div>
          <StatusBadge tone="warning">Por renovar</StatusBadge>
          <p>Tu plan de ejemplo se renueva pronto.</p>
          <Link className="bd-text-button" to="/negocio/suscripcion">Revisar suscripción →</Link>
        </div>
        {expiring.length > 0 && <div>
          <StatusBadge tone="warning">Próxima a vencer</StatusBadge>
          <p>{number(expiring.length)} dinámicas vencen en los próximos 7 días.</p>
          <Link className="bd-text-button" to="/negocio/dinamicas">Consultar dinámicas →</Link>
        </div>}{employees.some(e => !e.active) && <div>
          <StatusBadge tone="warning">Acceso suspendido</StatusBadge>
          <p>Hay empleados con acceso suspendido.</p>
          <Link className="bd-text-button" to="/negocio/sucursales">Ver equipo →</Link>
        </div>}</div>
    </Card>
    <div className="bd-grid">
      <Chart />
      <Heatmap />
    </div>
    <Card title="Actividad reciente">
      <table className="bd-responsive-table">
        <thead>
          <tr>
            <th>Actividad</th>
            <th>Sucursal</th>
            <th>Momento</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>{[['Recompensa canjeada', 'Centro', 'Hace 5 minutos'], ['Visita registrada', 'Río', 'Hace 12 minutos'], ['Nuevo cliente', 'Centro', 'Hace 24 minutos']].map(row => <tr key={row[0]}>{row.map((cell, i) => <td key={i} data-label={['Actividad', 'Sucursal', 'Momento'][i]}>{cell}</td>)}<td data-label="Estado">
          <StatusBadge tone="success">Completado</StatusBadge>
        </td>
        </tr>)}</tbody>
      </table>
    </Card>{completed < tasks.length && <Card title="Lista de arranque" extra={<StatusBadge tone="info">{number(completed)} de {number(tasks.length)}</StatusBadge>}>
      <label className="bd-sr-only" htmlFor="bd-startup">Progreso de configuración</label>
      <progress id="bd-startup" max={tasks.length} value={completed} />
      <ol className="bd-startup">{tasks.map(task => <li key={task.label}>
        <StatusBadge tone={task.done ? 'success' : 'neutral'}>{task.done ? 'Completado' : 'Pendiente'}</StatusBadge>
        <Link to={task.to}>{task.label} →</Link>
      </li>)}</ol>
    </Card>}</>;
}
