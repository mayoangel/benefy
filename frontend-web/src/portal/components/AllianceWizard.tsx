import { useEffect, useId, useRef, useState } from 'react';

import { ApiError, api } from '../../lib/api.ts';
import type { AlianzaDetalle, NegocioAliado } from '../../lib/types.ts';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges.ts';

function fechaISO(value: string, fin = false) {
  return new Date(`${value}T${fin ? '23:59:59' : '00:00:00'}`).toISOString();
}

function fechaCorta(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function AllianceWizard({
  businessId,
  merchant,
  onClose,
  onCreated,
}: {
  businessId: number;
  merchant: NegocioAliado;
  onClose: () => void;
  onCreated: (alianza: AlianzaDetalle) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const hoy = new Date().toISOString().slice(0, 10);
  const finInicial = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const [paso, setPaso] = useState(0);
  const [condicion, setCondicion] = useState('');
  const [inicio, setInicio] = useState(hoy);
  const [fin, setFin] = useState(finInicial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = Boolean(condicion.trim()) || inicio !== hoy || fin !== finInicial;
  const { confirmClose } = useUnsavedChanges(dirty);

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);

  function solicitarCierre() {
    if (busy) return;
    confirmClose(onClose);
  }

  async function enviar() {
    setBusy(true);
    setError(null);
    try {
      const alianza = await api.createAlliance({
        negocio: businessId,
        negocio_destino: merchant.id,
        condicion_participacion: condicion.trim(),
        fecha_inicio: fechaISO(inicio),
        fecha_fin: fechaISO(fin, true),
      });
      onCreated(alianza);
    } catch (err) {
      if (err instanceof ApiError && err.codigo === 'limite_plan') {
        setError(`${err.message} Puedes revisar el plan premium para enviar solicitudes.`);
      } else {
        setError(err instanceof Error ? err.message : 'No se pudo enviar la propuesta.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="portal-alliance-dialog"
      aria-labelledby={`${id}-title`}
      onCancel={(event) => {
        event.preventDefault();
        solicitarCierre();
      }}
    >
      <div className="portal-alliance-head">
        <div>
          <span className="portal-eyebrow">Nueva alianza</span>
          <h2 id={`${id}-title`}>Proponer a {merchant.nombre}</h2>
          <p>{merchant.categoria_nombre} · {merchant.direccion}</p>
        </div>
        <button type="button" className="portal-button-secondary" onClick={solicitarCierre} disabled={busy}>
          Cerrar
        </button>
      </div>

      <ol className="portal-wizard-steps" aria-label="Pasos de la propuesta">
        <li className={paso === 0 ? 'is-current' : paso > 0 ? 'is-done' : ''}>
          <span>1</span> Condiciones
        </li>
        <li className={paso === 1 ? 'is-current' : ''}>
          <span>2</span> Revisión
        </li>
      </ol>

      {error ? <p className="portal-state portal-state-error" role="alert">{error}</p> : null}

      {paso === 0 ? (
        <div className="portal-alliance-body">
          <div className="portal-form-grid">
            <label className="portal-form-wide" htmlFor={`${id}-condicion`}>
              <span>Condición de participación</span>
              <textarea
                id={`${id}-condicion`}
                rows={4}
                value={condicion}
                onChange={(event) => setCondicion(event.target.value)}
                placeholder="Ej. Los clientes de ambos negocios reciben un beneficio al presentar su tarjeta."
                maxLength={2000}
                required
              />
            </label>
            <label htmlFor={`${id}-inicio`}>
              <span>Inicio</span>
              <input
                id={`${id}-inicio`}
                type="date"
                value={inicio}
                min={hoy}
                onChange={(event) => setInicio(event.target.value)}
                required
              />
            </label>
            <label htmlFor={`${id}-fin`}>
              <span>Fin</span>
              <input
                id={`${id}-fin`}
                type="date"
                value={fin}
                min={inicio}
                onChange={(event) => setFin(event.target.value)}
                required
              />
            </label>
          </div>
          <p className="portal-note">
            Los beneficios estructurados se agregan después de que el otro negocio acepte.
            Así ambos propietarios pueden definir qué ofrece cada uno.
          </p>
          <div className="portal-form-actions">
            <button
              type="button"
              className="portal-button"
              disabled={!condicion.trim() || !inicio || !fin || fin < inicio}
              onClick={() => setPaso(1)}
            >
              Revisar propuesta
            </button>
          </div>
        </div>
      ) : (
        <div className="portal-alliance-body">
          <dl className="portal-review">
            <div><dt>Comercio</dt><dd>{merchant.nombre}</dd></div>
            <div><dt>Condición</dt><dd>{condicion.trim()}</dd></div>
            <div><dt>Vigencia</dt><dd>{fechaCorta(inicio)} a {fechaCorta(fin)}</dd></div>
          </dl>
          <p className="portal-muted">
            La solicitud quedará pendiente hasta que un propietario de {merchant.nombre} la acepte.
            No se comparten datos de clientes ni ventas.
          </p>
          <div className="portal-form-actions">
            <button type="button" className="portal-button-secondary" onClick={() => setPaso(0)} disabled={busy}>
              Volver
            </button>
            <button type="button" className="portal-button" onClick={() => void enviar()} disabled={busy}>
              {busy ? 'Enviando...' : 'Enviar propuesta'}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
