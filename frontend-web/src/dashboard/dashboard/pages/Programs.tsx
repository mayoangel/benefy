import { useState } from 'react';
import { useDemoData } from '../data/DemoDataProvider';
import { type Dynamic } from '../data/demoData';
import { date, number, today } from '../data/format';
import Card from '../components/Card';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import ConfirmModal from '../components/ConfirmModal';
import DynamicWizard from '../components/DynamicWizard';
import DynamicPreview from '../components/DynamicPreview';
import useOperation from '../hooks/useOperation';
export default function Programs() {
  const { dynamics, setDynamics } = useDemoData();
  const [editing, setEditing] = useState<Dynamic | 'new' | null>(null);
  const [viewing, setViewing] = useState<Dynamic | null>(null);
  const [deactivating, setDeactivating] = useState<Dynamic | null>(null);
  const { busy, run } = useOperation();
  return <>
    <div className="bd-toolbar">
      <p>Convierte cada visita en una razón para volver.</p>
      <button className="bd-button" onClick={() => setEditing('new')}>+ Crear dinámica</button>
    </div>{!dynamics.length ? <EmptyState message="Aún no tienes dinámicas" action="Crear dinámica" onAction={() => setEditing('new')} /> : <Card title="Tus dinámicas">
      <table className="bd-responsive-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Tipo</th>
            <th>Vigencia</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>{dynamics.map(item => {
          const expired = item.end < today(); const future = item.start > today(); return <tr key={item.id}>
            <td data-label="Nombre">{item.name}</td>
            <td data-label="Tipo">{item.type}</td>
            <td data-label="Vigencia">{date(item.start)} – {date(item.end)}</td>
            <td data-label="Estado">
              <StatusBadge tone={!item.active ? 'neutral' : expired ? 'danger' : future ? 'info' : 'success'}>{!item.active ? 'Desactivada' : expired ? 'Vencida' : future ? 'Programada' : 'Activa'}</StatusBadge>
            </td>
            <td data-label="Acciones">
              <div className="bd-row-actions">
                <button className="bd-text-button" onClick={() => setViewing(item)}>Consultar</button>
                <button className="bd-text-button" onClick={() => setEditing(item)}>Editar</button>
                <button className="bd-text-button" disabled={!item.active} onClick={() => setDeactivating(item)}>Desactivar</button>
              </div>
            </td>
          </tr>;
        })}</tbody>
      </table>
    </Card>}{editing && <DynamicWizard initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}{viewing && <Modal title={viewing.name} onClose={() => setViewing(null)}>
      <DynamicPreview draft={{ ...viewing, goal: String(viewing.goal), conversion: String(viewing.conversion) }} />
      <p>Vigencia: {date(viewing.start)} – {date(viewing.end)}</p>
      <p>{viewing.type === 'cupones' ? 'Descuento' : 'Meta'}: {number(viewing.goal)}{viewing.type === 'cupones' ? ' %' : ''}</p>
    </Modal>}{deactivating && <ConfirmModal title="Desactivar dinámica" message="Los clientes dejarán de participar en esta dinámica; el registro se conservará para consulta." confirmLabel="Desactivar" busy={busy} onClose={() => { if (!busy) setDeactivating(null); }} onConfirm={() => void run(() => { setDynamics(previous => previous.map(item => item.id === deactivating.id ? { ...item, active: false } : item)); setDeactivating(null); }, 'Dinámica desactivada.')} />}</>;
}
