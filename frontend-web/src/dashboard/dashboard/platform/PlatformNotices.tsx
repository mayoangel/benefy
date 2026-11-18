import { useEffect, useState, type FormEvent } from 'react';
import { hasSession, request } from '../../lib/webAuth';
import Icon from '../../components/Icon';
import Card from '../components/Card';
import { utc6, type Row } from './platformData';

interface Notice extends Row {
  inicio: string;
  fin: string;
  mensaje: string;
}

const windowLabel = (notice: Notice) => `${utc6.format(new Date(notice.inicio))} — ${utc6.format(new Date(notice.fin))} (UTC−6)`;

export function BusinessMaintenance() {
  const [notices, setNotices] = useState<Notice[]>([]);
  useEffect(() => {
    if (!hasSession()) return;
    const controller = new AbortController();
    void request<Notice[]>('/mantenimiento/vigente/', { signal: controller.signal })
      .then(setNotices).catch(() => undefined);
    return () => controller.abort();
  }, []);
  return <>{notices.map(notice => <div className="bd-banner bd-platform-maintenance" role="status" key={notice.id}>
    <Icon name="notifications" />
    <div><strong>Mantenimiento programado</strong><p>{notice.mensaje}</p><small>{windowLabel(notice)}</small></div>
  </div>)}</>;
}

export default function PlatformNotices({ notices, onChange, preview = false }: { notices: Notice[]; onChange: () => void; preview?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const start = new Date(`${data.get('inicio')}-06:00`);
    const end = new Date(`${data.get('fin')}-06:00`);
    setSaved(false);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      setError('Selecciona fechas válidas. El fin debe ser posterior al inicio.');
      return;
    }
    if (start.getTime() < Date.now() + 48 * 60 * 60 * 1000) {
      setError('Programa el aviso con al menos 48 h de anticipación.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await request('/plataforma/avisos/', { method: 'POST', body: JSON.stringify({
        inicio: start.toISOString(), fin: end.toISOString(), mensaje: data.get('mensaje'),
      }) });
      form.reset();
      setSaved(true);
      onChange();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'No se pudo publicar el aviso.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="bd-platform-stack">
    {!preview && <Card title="Programar mantenimiento">
      <p className="bd-muted">Usa UTC−6. La ventana habitual es el domingo de 02:00 a 04:00. Publica con al menos 48 h de anticipación.</p>
      <form className="bd-form" onSubmit={publish}>
        <label>Inicio (UTC−6)<input type="datetime-local" name="inicio" required /></label>
        <label>Fin (UTC−6)<input type="datetime-local" name="fin" required /></label>
        <label className="bd-form-wide">Mensaje<textarea name="mensaje" required maxLength={1000} /></label>
        <div className="bd-form-actions"><button type="submit" className="bd-button" disabled={busy}>{busy ? 'Publicando…' : 'Publicar aviso'}</button></div>
        {error && <p className="bd-form-wide bd-field-error" role="alert">{error}</p>}
        {saved && <p className="bd-form-wide" role="status">El aviso se publicó en el panel del dueño.</p>}
      </form>
    </Card>}
    <Card title="Avisos publicados">
      {notices.length ? <ul className="bd-platform-history">{notices.map(notice => <li key={notice.id}>
        <small>{windowLabel(notice)}</small><p>{notice.mensaje}</p>
      </li>)}</ul> : <p className="bd-muted">Aún no hay avisos de mantenimiento.</p>}
    </Card>
  </div>;
}
