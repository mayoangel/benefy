import Icon from '../../components/Icon';
export default function EmptyState({ message = 'Aún no hay registros.', action = 'Crear registro', onAction }: { message?: string; action?: string; onAction?: () => void }) {
  return <section className="bd-card bd-state">
    <Icon name="storefront" />
    <h2>{message}</h2>{onAction && <button className="bd-button" onClick={onAction}>{action}</button>}</section>;
}
