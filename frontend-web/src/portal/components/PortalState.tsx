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
      <svg className="portal-empty-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M4 5h16v14H4V5Zm4 5h8m-8 4h5" /></svg>
      <h2>Sin resultados</h2>
      <p>{message}</p>
    </div>
  );
}
