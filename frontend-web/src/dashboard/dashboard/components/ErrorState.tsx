import Icon from '../../components/Icon';
export default function ErrorState({ onRetry }: { onRetry: () => void }) {
  return <section className="bd-card bd-state" role="alert">
    <Icon name="cancel" />
    <h2>No pudimos cargar esta información</h2>
    <p>Intenta de nuevo para consultar tus datos.</p>
    <button className="bd-secondary" onClick={onRetry}>Reintentar</button>
  </section>;
}
