import { useEffect, useId, useRef, type ReactNode } from 'react';
import Icon from '../../components/Icon';
import { useUI } from '../data/UIProvider';

let openModals = 0;
let originalOverflow = '';
export default function Modal({ title, children, onClose, className = '', busy = false }: { title: string; children: ReactNode; onClose: () => void; className?: string; busy?: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { online } = useUI();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (openModals === 0) originalOverflow = document.body.style.overflow;
    openModals += 1;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      openModals -= 1;
      if (openModals === 0) document.body.style.overflow = originalOverflow;
    };
  }, []);

  return <dialog ref={dialogRef} className={`bd-modal ${className}`} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
  }}>
    <div className="bd-modal-heading">
      <h2 id={titleId}>{title}</h2>
      <button className="bd-modal-close" type="button" aria-label="Cerrar ventana" disabled={busy} onClick={onClose}>
        <Icon name="close" />
      </button>
    </div>
    {!online && <p className="bd-banner" role="status">Sin conexión: no se pueden confirmar operaciones</p>}
    {children}
  </dialog>;
}
