export default function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return <div className="bd-toast" role="status">
    <span>{message}</span>
    <button type="button" aria-label="Cerrar aviso" onClick={onClose}>×</button>
  </div>;
}
