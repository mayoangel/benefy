import type { DynamicDraft } from '../data/dynamicValidation';
import Icon from '../../components/Icon';
import { number } from '../data/format';
export default function DynamicPreview({ draft }: { draft: DynamicDraft }) {
  const goal = Number(draft.goal) || 0;
  const seals = Math.max(1, Math.min(12, Math.floor(goal) || 8));
  return <aside className="bd-preview">
    <span className="bd-eyebrow">VISTA PREVIA DEL CLIENTE</span>
    <div className="bd-loyalty-card">
      <Icon name={draft.type === 'sellos' ? 'local_cafe' : draft.type === 'puntos' ? 'stars' : 'confirmation_number'} />
      <h3>{draft.name.trim() || 'Tu próxima recompensa'}</h3>{draft.type === 'sellos' ? <>
        <div className="bd-seals" aria-label={`Ejemplo: 2 de ${number(goal || 8)} sellos`}>{Array.from({ length: seals }, (_, i) => <span key={i} className={i < 2 ? 'is-filled' : ''} aria-hidden="true">{i < 2 ? '✓' : '○'}</span>)}</div>
        <p>Meta: {number(goal || 8)} sellos</p>
      </> : draft.type === 'puntos' ? <>
        <strong>{number(goal)} puntos</strong>
        <p>1 punto por cada {number(Number(draft.conversion) || 0)} MXN</p>
        <progress value={25} max={100} aria-label="Ejemplo de progreso: 25 por ciento" />
      </> : <strong>{number(goal, 2)} % de descuento</strong>}<p>{draft.reward.trim() || 'La recompensa que hará que vuelvan.'}</p>
      <small>Vista ilustrativa · Sin valor comercial</small>
    </div>
  </aside>;
}
