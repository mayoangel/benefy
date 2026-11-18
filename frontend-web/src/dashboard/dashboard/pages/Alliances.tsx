import { useState } from 'react';
import Card from '../components/Card';
import Tabs from '../components/Tabs';
import StatusBadge from '../components/StatusBadge';
import ConfirmModal from '../components/ConfirmModal';
import EmptyState from '../components/EmptyState';
import AllianceWizard from '../components/AllianceWizard';
import { useDemoData } from '../data/DemoDataProvider';
import { merchants, ownMerchantId, type Alliance } from '../data/demoData';
import { date } from '../data/format';
import useOperation from '../hooks/useOperation';
export default function Alliances() {
  const { alliances, setAlliances } = useDemoData();
  const [tab, setTab] = useState(0); const [wizard, setWizard] = useState<number | null>(null);
  const [confirmation, setConfirmation] = useState<{ item: Alliance; accept: boolean } | null>(null);
  const { busy, run } = useOperation();
  const list = alliances.filter(item => tab === 3 ? item.status === 'Activa' : item.direction === (tab === 1 ? 'sent' : 'received') && item.status !== 'Activa');
  return <>
    <div className="bd-toolbar">
      <p>Comparte beneficios con comercios de tu comunidad.</p>
      <button className="bd-button" onClick={() => setWizard(0)}>+ Proponer alianza</button>
    </div>
    <Tabs labels={['Comercios disponibles', 'Solicitudes enviadas', 'Solicitudes recibidas', 'Alianzas activas']} selected={tab} onSelect={setTab}>{tab === 0 ? <div className="bd-program-grid">{merchants.filter(m => m.id !== ownMerchantId).map(m => <Card key={m.id} title={m.name}>
      <p className="bd-muted">{m.category}</p>
      <button className="bd-secondary" onClick={() => setWizard(m.id)}>Proponer alianza</button>
    </Card>)}</div> : !list.length ? <EmptyState message={tab === 3 ? 'Aún no tienes alianzas activas' : 'No hay solicitudes en esta sección'} action="Explorar comercios" onAction={() => setTab(0)} /> : <div className="bd-program-grid">{list.map(item => <Card key={item.id} title={merchants.find(m => m.id === item.merchantId)?.name || 'Comercio'} extra={<StatusBadge tone={item.status === 'Activa' ? 'success' : item.status === 'Rechazada' ? 'danger' : 'warning'}>{item.status}</StatusBadge>}>
      <dl className="bd-review">
        <dt>Condición</dt>
        <dd>{item.condition}</dd>
        <dt>Beneficio</dt>
        <dd>{item.benefit}</dd>
        <dt>Vigencia</dt>
        <dd>{date(item.start)} – {date(item.end)}</dd>
      </dl>{item.direction === 'received' && item.status === 'Pendiente' && <div className="bd-row-actions">
        <button className="bd-button" onClick={() => setConfirmation({ item, accept: true })}>Aceptar</button>
        <button className="bd-secondary" onClick={() => setConfirmation({ item, accept: false })}>Rechazar</button>
      </div>}</Card>)}</div>}</Tabs>{wizard !== null && <AllianceWizard merchantId={wizard || undefined} onClose={() => setWizard(null)} />}{confirmation && <ConfirmModal title={confirmation.accept ? 'Aceptar alianza' : 'Rechazar solicitud'} message={confirmation.accept ? 'La alianza quedará activa en esta demostración y sus beneficios estarán disponibles para consulta.' : 'La solicitud quedará rechazada y no activará beneficios.'} confirmLabel={confirmation.accept ? 'Aceptar alianza' : 'Rechazar solicitud'} busy={busy} onClose={() => { if (!busy) setConfirmation(null); }} onConfirm={() => void run(() => { setAlliances(previous => previous.map(item => item.id === confirmation.item.id ? { ...item, status: confirmation.accept ? 'Activa' : 'Rechazada' } : item)); setConfirmation(null); }, confirmation.accept ? 'Alianza activada.' : 'Solicitud rechazada.')} />}</>;
}
