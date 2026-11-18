import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import Card from '../components/Card';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import StatusBadge from '../components/StatusBadge';
import { useDemoData } from '../data/DemoDataProvider';
import { money } from '../data/format';
import useOperation from '../hooks/useOperation';
const plans = [{ name: 'Comercio Local', price: 499, items: ['1 terminal', 'Hasta 2 dinámicas activas', 'Hasta 2 alianzas'] }, { name: 'Negocio Pro', price: 999, items: ['Hasta 3 terminales', 'Dinámicas y alianzas ilimitadas', 'Analítica avanzada'] }, { name: 'Multisede / Corporativo', price: 1899, items: ['Múltiples sucursales', 'Terminales y roles ilimitados', 'Soporte prioritario'] }];
export default function Subscription() {
  const { plan, setPlan } = useDemoData(); const [state, setState] = useState('active');
  const [selected, setSelected] = useState(''); const [portal, setPortal] = useState(false);
  const { busy, run } = useOperation(); const current = plans.find(p => p.name === plan)!;
  const status = state === 'pending' ? 'Pago pendiente' : state === 'cancelled' ? 'Cancelada' : state === 'error' ? 'Error de servicio' : 'Activa';
  return <>
    <label className="bd-filter">Estado de ejemplo<select value={state} onChange={e => setState(e.target.value)}>
      <option value="active">Activa</option>
      <option value="pending">Pago pendiente</option>
      <option value="cancelled">Cancelada</option>
      <option value="error">Error de servicio</option>
    </select>
    </label>{state !== 'active' && <div className="bd-banner" role="status">
      <StatusBadge tone={state === 'pending' ? 'warning' : 'danger'}>{status}</StatusBadge>
      <p>{state === 'pending' ? 'Tu pago no pudo ser procesado. Revisa tu tarjeta en el portal de facturación' : state === 'error' ? 'El servicio de pagos no responde en este momento. Por favor, intenta de nuevo más tarde' : 'Tu suscripción está cancelada en esta demostración. Puedes consultar los planes disponibles.'}</p>{state === 'error' && <button className="bd-secondary" onClick={() => void run(() => setState('active'), 'Servicio de ejemplo disponible de nuevo.')} disabled={busy}>{busy ? 'Comprobando…' : 'Reintentar'}</button>}</div>}<div className="bd-current-plan">
      <div>
        <span className="bd-eyebrow">TU PLAN DE EJEMPLO</span>
        <h2>{plan}</h2>
        <StatusBadge tone={state === 'active' ? 'success' : state === 'pending' ? 'warning' : 'danger'}>{status}</StatusBadge>
        <p>Más herramientas para construir relaciones que duran.</p>
      </div>
      <div>
        <strong>{money(current.price)} <small>MXN / mes</small>
        </strong>
        <p>Facturación mensual · Sin cobros en esta demo</p>
        <button className="bd-button" onClick={() => setPortal(true)}>Gestionar suscripción</button>
      </div>
    </div>
    <div className="bd-program-grid bd-plans">{plans.map(p => <article className={`bd-card bd-plan ${p.name === plan ? 'bd-plan-current' : ''}`} key={p.name}>
      <span className="bd-eyebrow">{p.name === plan ? 'PLAN ACTUAL' : 'CRECE A TU RITMO'}</span>
      <h2>{p.name}</h2>
      <strong>{money(p.price)}<small> MXN / mes</small>
      </strong>
      <ul>{p.items.map(item => <li key={item}>
        <Icon name="check" />{item}</li>)}</ul>
      <button className="bd-secondary" disabled={p.name === plan} onClick={() => setSelected(p.name)}>{p.name === plan ? 'Tu plan actual' : 'Cambiar de plan'}</button>
    </article>)}</div>
    <Link className="bd-text-button" to="/precios">Consultar todas las características de los planes →</Link>{selected && <ConfirmModal title={`Cambiar a ${selected}`} message="El cambio solo se reflejará durante esta demostración. No se generarán cargos." confirmLabel="Simular cambio" busy={busy} onClose={() => { if (!busy) setSelected(''); }} onConfirm={() => void run(() => { setPlan(selected); setSelected(''); }, 'Plan actualizado en la demostración.')} />}{portal && <Modal title="Portal de facturación de ejemplo" onClose={() => setPortal(false)}>
      <Card title="Gestión de suscripción">
        <p>La gestión de pagos está en preparación. No se solicitan datos de tarjeta y no se realizan cargos.</p>
      </Card>
      <button className="bd-secondary" onClick={() => setPortal(false)}>Cerrar</button>
    </Modal>}</>;
}
