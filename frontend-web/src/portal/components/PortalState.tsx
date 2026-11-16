export function PortalLoading({ label = 'Cargando información...' }: { label?: string }) {
  return (
    <div className="portal-state">
      <span className="portal-spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function PortalError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="portal-state portal-state-error" role="alert">
      <strong>No se pudo cargar la información</strong>
      <p>{message}</p>
      {onRetry ? <button type="button" onClick={onRetry}>Reintentar</button> : null}
    </div>
  );
}

export function PortalEmpty({ message }: { message: string }) {
  return (
    <div className="portal-state portal-state-empty">
      <p>{message}</p>
    </div>
  );
}
