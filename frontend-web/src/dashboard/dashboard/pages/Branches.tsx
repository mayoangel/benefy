import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import Card from '../components/Card';
import ConfirmModal from '../components/ConfirmModal';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import BranchForm from '../components/BranchForm';
import BranchQR from '../components/BranchQR';
import { useDemoData } from '../data/DemoDataProvider';
import type { Branch, Employee } from '../data/demoData';
import { number } from '../data/format';
import useOperation from '../hooks/useOperation';
export default function Branches() {
  const { branches, setBranches, employees, setEmployees } = useDemoData();
  const params = useParams(); const isDetail = Boolean(params['*']); const branchId = Number(params['*']);
  const navigate = useNavigate();
  const branch = branches.find(b => b.id === branchId);
  const activeBranches = branches.filter(b => !b.archived);
  const [form, setForm] = useState<{ initial?: Branch; employeeBranch?: number } | null>(null);
  const [qr, setQr] = useState<Branch | null>(null);
  const [employeeConfirmation, setEmployeeConfirmation] = useState<Employee | null>(null);
  const [archiving, setArchiving] = useState<Branch | null>(null);
  const { busy, run } = useOperation();
  const team = employees.filter(e => !branchId ? !branches.find(b => b.id === e.branch)?.archived : e.branch === branchId);
  const employeeTable = <Card title={branch ? `Equipo de ${branch.name}` : 'Equipo de todas las sucursales'} extra={<button className="bd-secondary" disabled={!activeBranches.length || branch?.archived} onClick={() => setForm({ employeeBranch: branchId || activeBranches[0]?.id })}>+ Agregar empleado</button>}>{!team.length ? <EmptyState message="Esta sucursal aún no tiene empleados" action="Agregar empleado" onAction={activeBranches.length && !branch?.archived ? () => setForm({ employeeBranch: branchId || activeBranches[0].id }) : undefined} /> : <table className="bd-responsive-table">
    <thead>
      <tr>
        <th>Empleado</th>
        <th>Sucursal</th>
        <th>Rol</th>
        <th>Acceso</th>
        <th>Acción</th>
      </tr>
    </thead>
    <tbody>{team.map(e => <tr key={e.id}>
      <td data-label="Empleado">{e.name}</td>
      <td data-label="Sucursal">{branches.find(b => b.id === e.branch)?.name}</td>
      <td data-label="Rol">
        <label>
          <span className="bd-sr-only">Rol de {e.name}</span>
          <select value={e.role} disabled={busy || branch?.archived} onChange={event => { const role = event.target.value; void run(() => setEmployees(previous => previous.map(item => item.id === e.id ? { ...item, role } : item)), 'Rol actualizado.'); }}>
            <option>Cajero</option>
            <option>Gerente</option>
          </select>
        </label>
      </td>
      <td data-label="Acceso">
        <StatusBadge tone={e.active ? 'success' : 'warning'}>{e.active ? 'Activo' : 'Suspendido'}</StatusBadge>
      </td>
      <td data-label="Acción">
        <button className="bd-text-button" disabled={busy || branch?.archived} onClick={() => setEmployeeConfirmation(e)}>{e.active ? 'Suspender' : 'Reactivar'}</button>
      </td>
    </tr>)}</tbody>
  </table>}</Card>;
  return <>{isDetail ? <>
    <Link className="bd-text-button" to="/negocio/sucursales">← Volver a sucursales</Link>{branch ? <>
      <Card title={branch.name} extra={<StatusBadge tone={branch.archived ? 'neutral' : 'success'}>{branch.archived ? 'Archivada' : 'Activa'}</StatusBadge>}>
        <p>{branch.address}</p>
        <p>{number(team.filter(e => e.active).length)} empleados activos</p>
        <div className="bd-row-actions">
          <button className="bd-secondary" onClick={() => setQr(branch)}>Ver QR de la sucursal</button>
          <button className="bd-text-button" disabled={branch.archived} onClick={() => setForm({ initial: branch })}>Editar sucursal</button>
          <button className="bd-text-button" disabled={branch.archived} onClick={() => setArchiving(branch)}>Archivar</button>
        </div>
      </Card>{employeeTable}</> : <EmptyState message="No encontramos esta sucursal" action="Volver a sucursales" onAction={() => navigate('/negocio/sucursales')} />}</> : <>
    <div className="bd-toolbar">
      <p>Organiza los espacios donde suceden las buenas experiencias.</p>
      <button className="bd-button" onClick={() => setForm({})}>+ Registrar sucursal</button>
    </div>{!activeBranches.length ? <EmptyState message="Aún no tienes sucursales" action="Registrar la primera" onAction={() => setForm({})} /> : <>
      <div className="bd-program-grid">{activeBranches.map(b => <article className="bd-card" key={b.id}>
        <div className="bd-card-heading">
          <span className="bd-feature-icon">
            <Icon name="storefront" />
          </span>
          <StatusBadge tone="success">Activa</StatusBadge>
        </div>
        <h2>{b.name}</h2>
        <p className="bd-muted">{b.address}</p>
        <div className="bd-branch-footer">
          <span>{number(employees.filter(e => e.branch === b.id && e.active).length)} empleados activos</span>
          <Link className="bd-text-button" to={`/negocio/sucursales/${b.id}`}>Ver equipo →</Link>
        </div>
        <div className="bd-row-actions">
          <button className="bd-secondary" onClick={() => setQr(b)}>Ver QR de la sucursal</button>
          <button className="bd-text-button" onClick={() => setForm({ initial: b })}>Editar</button>
          <button className="bd-text-button" onClick={() => setArchiving(b)}>Archivar</button>
        </div>
      </article>)}</div>{employeeTable}</>}</>}{form && <BranchForm {...form} onClose={() => setForm(null)} />}{qr && <BranchQR branch={qr} onClose={() => setQr(null)} />}{employeeConfirmation && <ConfirmModal title={`${employeeConfirmation.active ? 'Suspender' : 'Reactivar'} empleado`} message={employeeConfirmation.active ? 'El empleado perderá su acceso a esta sucursal.' : 'El empleado recuperará su acceso a esta sucursal.'} confirmLabel={employeeConfirmation.active ? 'Suspender' : 'Reactivar'} busy={busy} onClose={() => { if (!busy) setEmployeeConfirmation(null); }} onConfirm={() => void run(() => { setEmployees(previous => previous.map(item => item.id === employeeConfirmation.id ? { ...item, active: !item.active } : item)); setEmployeeConfirmation(null); }, employeeConfirmation.active ? 'Empleado suspendido.' : 'Empleado reactivado.')} />}{archiving && <ConfirmModal title="Archivar sucursal" message="La sucursal dejará de aparecer en la lista y se suspenderá el acceso de su equipo. Sus datos se conservarán en esta sesión." confirmLabel="Archivar sucursal" busy={busy} onClose={() => { if (!busy) setArchiving(null); }} onConfirm={() => void run(() => { setBranches(previous => previous.map(b => b.id === archiving.id ? { ...b, archived: true } : b)); setEmployees(previous => previous.map(e => e.branch === archiving.id ? { ...e, active: false } : e)); setArchiving(null); if (branchId) navigate('/negocio/sucursales'); }, 'Sucursal archivada y accesos suspendidos.')} />}</>;
}
