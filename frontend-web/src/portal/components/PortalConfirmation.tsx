import { useCallback, useEffect, useId, useRef, useState } from 'react';

type Confirmation = { title: string; message: string; action: string };

export function usePortalConfirmation() {
  const [request, setRequest] = useState<Confirmation | null>(null);
  const pending = useRef<((confirmed: boolean) => void) | null>(null);
  const confirm = useCallback((next: Confirmation) => new Promise<boolean>(resolve => {
    pending.current?.(false);
    pending.current = resolve;
    setRequest(next);
  }), []);
  const resolve = useCallback((confirmed: boolean) => {
    pending.current?.(confirmed);
    pending.current = null;
    setRequest(null);
  }, []);
  useEffect(() => () => { pending.current?.(false); pending.current = null; }, []);
  return { confirm, confirmation: <PortalConfirmation request={request} onResolve={resolve} /> };
}

function PortalConfirmation({ request, onResolve }: { request: Confirmation | null; onResolve: (value: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    if (request && !dialog.current?.open) dialog.current?.showModal();
  }, [request]);
  return <dialog ref={dialog} className="portal-confirmation" aria-labelledby={`${id}-title`} aria-describedby={`${id}-message`} onClose={event => {
    const confirmed = event.currentTarget.returnValue === 'confirm';
    // Escape must never inherit the value from a previous confirmation.
    event.currentTarget.returnValue = '';
    onResolve(confirmed);
  }}>
    <span className="portal-eyebrow">Confirma la operación</span>
    <h2 id={`${id}-title`}>{request?.title}</h2>
    <p id={`${id}-message`}>{request?.message}</p>
    <form method="dialog" className="portal-confirmation-actions">
      <button className="portal-button-secondary" value="cancel" autoFocus>Cancelar</button>
      <button className="portal-button" value="confirm">{request?.action}</button>
    </form>
  </dialog>;
}
