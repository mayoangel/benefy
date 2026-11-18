import Modal from './Modal';
export default function ConfirmModal({ title, message, onConfirm, onClose, confirmLabel = 'Confirmar', busy = false, cancelLabel = 'Cancelar' }: { title: string; message: string; onConfirm: () => void; onClose: () => void; confirmLabel?: string; busy?: boolean; cancelLabel?: string }) {
  return <Modal busy={busy} title={title} onClose={() => { if (!busy) onClose(); }}>
    <p>{message}</p>
    <div className="bd-form-actions">
      <button autoFocus className="bd-secondary" disabled={busy} onClick={onClose}>{cancelLabel}</button>
      <button className="bd-button" disabled={busy} onClick={onConfirm}>{busy ? 'Guardando…' : confirmLabel}</button>
    </div>
  </Modal>;
}
