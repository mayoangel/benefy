import { FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiError, api } from '../../lib/api.ts';
import type { AlianzaDetalle, EstadoAlianza, RecompensaAlianza } from '../../lib/types.ts';
import { usePortalConfirmation } from './PortalConfirmation.tsx';
import { PortalError, PortalLoading } from './PortalState.tsx';
import { useRequestGuard } from '../hooks/useRequestGuard.ts';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges.ts';

const ESTADOS: Record<EstadoAlianza, { texto: string; clase: string }> = {
  pendiente: { texto: 'Pendiente', clase: 'is-soon' },
  activa: { texto: 'Activa', clase: 'is-on' },
  finalizada: { texto: 'Finalizada', clase: '' },
  rechazada: { texto: 'Rechazada', clase: 'is-danger' },
};

const FORM_BENEFICIO = {
  titulo: '',
  descripcion: '',
  tipo: 'gratis',
  descuento: '',
  costo_desbloqueo: '0',
  terminos_condiciones: 'Válido para clientes de ambos negocios durante la alianza.',
  vigencia_dias: '7',
  cantidad_disponible: '',
  status: true,
};

function fecha(value: string) {
  return new Date(value).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fechaHora(value: string) {
  return new Date(value).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function diasHasta(value: string) {
  return Math.max(0, Math.floor((new Date(value).getTime() - Date.now()) / 86400000));
}

function estadoAlianza(detalle: AlianzaDetalle) {
  if (detalle.status === 'activa' && !detalle.vigente) {
    return new Date(detalle.fecha_inicio) > new Date()
      ? { texto: 'Programada', clase: 'is-soon' }
      : { texto: 'Vencida', clase: 'is-danger' };
  }
  return ESTADOS[detalle.status];
}

export default function AllianceDetail({
  businessId,
  allianceId,
  puedeOperar,
  onClose,
  onChanged,
}: {
  businessId: number;
  allianceId: number;
  puedeOperar: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const { confirm, confirmation } = usePortalConfirmation();
  const [detalle, setDetalle] = useState<AlianzaDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [showBenefit, setShowBenefit] = useState(false);
  const [form, setForm] = useState({ ...FORM_BENEFICIO });
  const requestGuard = useRequestGuard(businessId);
  const dirty = showBenefit && Boolean(form.titulo.trim() || form.descripcion.trim());
  const { confirmClose } = useUnsavedChanges(dirty);

  const cargar = useCallback(async () => {
    const vigente = requestGuard();
    setLoading(true);
    setError(null);
    try {
      const respuesta = await api.getAlliance(businessId, allianceId);
      if (!vigente()) return;
      setDetalle(respuesta);
      const dias = diasHasta(respuesta.fecha_fin);
      setForm((actual) => ({
        ...actual,
        vigencia_dias: String(Math.max(1, Math.min(30, dias || 1))),
      }));
    } catch (err) {
      if (!vigente()) return;
      setError(err instanceof Error ? err.message : 'No se pudo cargar la alianza.');
    } finally {
      if (vigente()) setLoading(false);
    }
  }, [requestGuard, businessId, allianceId]);

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
    void cargar();
  }, [cargar]);

  function solicitarCierre() {
    if (busy) return;
    confirmClose(onClose);
  }

  async function responder(aceptar: boolean) {
    if (!detalle) return;
    const confirmado = await confirm({
      title: aceptar ? '¿Aceptar la alianza?' : '¿Rechazar la solicitud?',
      message: aceptar
        ? `La alianza con ${detalle.negocio1.nombre} quedará activa y podrán agregar beneficios.`
        : 'La solicitud quedará rechazada. Podrás recibir una nueva propuesta más adelante.',
      action: aceptar ? 'Aceptar alianza' : 'Rechazar solicitud',
    });
    if (!confirmado) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const actualizada = aceptar
        ? await api.acceptAlliance(businessId, allianceId)
        : await api.rejectAlliance(businessId, allianceId);
      setDetalle(actualizada);
      setOk(aceptar ? 'La alianza está activa.' : 'La solicitud fue rechazada.');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo responder la solicitud.');
    } finally {
      setBusy(false);
    }
  }

  async function finalizar() {
    if (!detalle) return;
    const confirmado = await confirm({
      title: '¿Finalizar la alianza?',
      message: 'Los beneficios de la alianza dejarán de estar disponibles. El historial se conserva.',
      action: 'Finalizar alianza',
    });
    if (!confirmado) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const actualizada = await api.finalizeAlliance(businessId, allianceId);
      setDetalle(actualizada);
      setOk('La alianza quedó finalizada.');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo finalizar la alianza.');
    } finally {
      setBusy(false);
    }
  }

  async function guardarBeneficio(event: FormEvent) {
    event.preventDefault();
    if (!detalle) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await api.createAllianceReward(businessId, allianceId, {
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim(),
        tipo: form.tipo,
        descuento: form.tipo === 'gratis' ? null : Number(form.descuento || 0),
        costo_desbloqueo: Number(form.costo_desbloqueo || 0),
        terminos_condiciones: form.terminos_condiciones.trim(),
        vigencia_dias: Number(form.vigencia_dias),
        cantidad_disponible: form.cantidad_disponible
          ? Number(form.cantidad_disponible) : null,
        status: form.status,
      });
      setShowBenefit(false);
      setForm({ ...FORM_BENEFICIO });
      setOk('Beneficio agregado a la alianza.');
      await cargar();
      onChanged();
    } catch (err) {
      if (err instanceof ApiError && err.codigo === 'limite_plan') {
        setError(`${err.message} Revisa el plan o desactiva otra recompensa.`);
      } else {
        setError(err instanceof Error ? err.message : 'No se pudo agregar el beneficio.');
      }
    } finally {
      setBusy(false);
    }
  }

  function agregarBeneficio() {
    if (!detalle) return;
    const dias = diasHasta(detalle.fecha_fin);
    setForm({
      ...FORM_BENEFICIO,
      vigencia_dias: String(Math.max(1, Math.min(30, dias || 1))),
    });
    setShowBenefit(true);
    setError(null);
    setOk(null);
  }

  const estado = detalle ? estadoAlianza(detalle) : ESTADOS.pendiente;
  const otro = detalle?.direccion === 'recibida' ? detalle.negocio1 : detalle?.negocio2;

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
          <span className="portal-eyebrow">Alianza comercial</span>
          <h2 id={`${id}-title`}>
            {loading || !detalle ? 'Detalle de la alianza' : otro?.nombre ?? 'Alianza'}
          </h2>
          {detalle ? <p>{detalle.direccion === 'recibida' ? 'Solicitud recibida' : 'Alianza con'} · {detalle.negocio1.nombre} ↔ {detalle.negocio2.nombre}</p> : null}
        </div>
        <button type="button" className="portal-button-secondary" onClick={solicitarCierre} disabled={busy}>
          Cerrar
        </button>
      </div>

      {confirmation}

      {loading ? <PortalLoading label="Cargando alianza..." /> : null}
      {error && !loading ? <PortalError message={error} onRetry={() => void cargar()} /> : null}
      {ok ? <p className="portal-note" role="status">{ok}</p> : null}

      {detalle && !loading ? (
        <>
          <div className="portal-alliance-summary">
            <div>
              <span className={`portal-badge ${estado.clase}`}>{estado.texto}</span>
              <p>{detalle.condicion_participacion}</p>
            </div>
            <dl className="portal-details">
              <div><dt>Vigencia</dt><dd>{fecha(detalle.fecha_inicio)} — {fecha(detalle.fecha_fin)}</dd></div>
              <div><dt>Solicitada</dt><dd>{fecha(detalle.fecha_solicitud)}</dd></div>
              {detalle.creado_por_correo ? <div><dt>Propuesta por</dt><dd>{detalle.creado_por_correo}</dd></div> : null}
              {detalle.respondido_por_correo ? <div><dt>Respondida por</dt><dd>{detalle.respondido_por_correo}</dd></div> : null}
            </dl>
          </div>

          {!puedeOperar && detalle.status === 'pendiente' ? (
            <p className="portal-note">
              Las alianzas están incluidas en Premium. <Link to="/precios">Conoce Premium</Link> para aceptar esta solicitud.
            </p>
          ) : null}

          {detalle.status === 'pendiente' && detalle.direccion === 'recibida' ? (
            <div className="portal-alliance-actions">
              <button type="button" className="portal-button" onClick={() => void responder(true)} disabled={busy || !puedeOperar}>
                Aceptar alianza
              </button>
              <button type="button" className="portal-button-secondary" onClick={() => void responder(false)} disabled={busy}>
                Rechazar
              </button>
            </div>
          ) : null}

          {detalle.status === 'activa' && detalle.puede_finalizar ? (
            <div className="portal-alliance-actions">
              <button type="button" className="portal-button-secondary" onClick={() => void finalizar()} disabled={busy}>
                Finalizar alianza
              </button>
            </div>
          ) : null}

          <section className="portal-alliance-section" aria-labelledby={`${id}-beneficios`}>
            <div className="portal-alliance-section-head">
              <div>
                <h3 id={`${id}-beneficios`}>Beneficios</h3>
                <p className="portal-muted">Recompensas que los clientes pueden adquirir en cada negocio.</p>
              </div>
              {detalle.puede_agregar_beneficio && puedeOperar && !showBenefit ? (
                <button type="button" className="portal-button-secondary" onClick={agregarBeneficio}>
                  Agregar beneficio
                </button>
              ) : null}
            </div>

            {detalle.recompensas.length > 0 ? (
              <ul className="portal-alliance-benefits">
                {detalle.recompensas.map((recompensa) => (
                  <Beneficio
                    key={recompensa.id}
                    recompensa={recompensa}
                    negocioNombre={
                      recompensa.negocio === detalle.negocio1.id
                        ? detalle.negocio1.nombre
                        : detalle.negocio2.nombre
                    }
                  />
                ))}
              </ul>
            ) : (
              <p className="portal-muted">Aún no hay beneficios agregados.</p>
            )}

            {showBenefit ? (
              <form className="portal-form portal-alliance-benefit-form" onSubmit={guardarBeneficio}>
                <h4>Nuevo beneficio</h4>
                <div className="portal-form-grid">
                  <label className="portal-form-wide" htmlFor={`${id}-benefit-title`}>
                    <span>Título</span>
                    <input
                      id={`${id}-benefit-title`}
                      value={form.titulo}
                      onChange={(event) => setForm({ ...form, titulo: event.target.value })}
                      maxLength={150}
                      required
                    />
                  </label>
                  <label htmlFor={`${id}-benefit-type`}>
                    <span>Tipo</span>
                    <select
                      id={`${id}-benefit-type`}
                      value={form.tipo}
                      onChange={(event) => setForm({ ...form, tipo: event.target.value })}
                    >
                      <option value="gratis">Producto o servicio gratis</option>
                      <option value="descuento">Descuento porcentual</option>
                      <option value="descuento_fijo">Descuento de monto fijo</option>
                    </select>
                  </label>
                  {form.tipo !== 'gratis' ? (
                    <label htmlFor={`${id}-benefit-discount`}>
                      <span>{form.tipo === 'descuento' ? 'Porcentaje' : 'Monto'}</span>
                      <input
                        id={`${id}-benefit-discount`}
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={form.descuento}
                        onChange={(event) => setForm({ ...form, descuento: event.target.value })}
                        required
                      />
                    </label>
                  ) : null}
                  <label htmlFor={`${id}-benefit-cost`}>
                    <span>Costo en puntos</span>
                    <input
                      id={`${id}-benefit-cost`}
                      type="number"
                      min="0"
                      value={form.costo_desbloqueo}
                      onChange={(event) => setForm({ ...form, costo_desbloqueo: event.target.value })}
                      required
                    />
                  </label>
                  <label htmlFor={`${id}-benefit-days`}>
                    <span>Vigencia del cupón (días)</span>
                    <input
                      id={`${id}-benefit-days`}
                      type="number"
                      min="1"
                      value={form.vigencia_dias}
                      onChange={(event) => setForm({ ...form, vigencia_dias: event.target.value })}
                      required
                    />
                  </label>
                  <label htmlFor={`${id}-benefit-stock`}>
                    <span>Stock (vacío = ilimitado)</span>
                    <input
                      id={`${id}-benefit-stock`}
                      type="number"
                      min="0"
                      value={form.cantidad_disponible}
                      onChange={(event) => setForm({ ...form, cantidad_disponible: event.target.value })}
                    />
                  </label>
                  <label className="portal-form-wide" htmlFor={`${id}-benefit-description`}>
                    <span>Descripción</span>
                    <textarea
                      id={`${id}-benefit-description`}
                      rows={2}
                      value={form.descripcion}
                      onChange={(event) => setForm({ ...form, descripcion: event.target.value })}
                      required
                    />
                  </label>
                  <label className="portal-form-wide" htmlFor={`${id}-benefit-terms`}>
                    <span>Términos y condiciones</span>
                    <textarea
                      id={`${id}-benefit-terms`}
                      rows={2}
                      value={form.terminos_condiciones}
                      onChange={(event) => setForm({ ...form, terminos_condiciones: event.target.value })}
                      required
                    />
                  </label>
                </div>
                <div className="portal-form-actions">
                  <button type="button" className="portal-button-secondary" onClick={() => setShowBenefit(false)} disabled={busy}>
                    Cancelar
                  </button>
                  <button type="submit" className="portal-button" disabled={busy}>
                    {busy ? 'Guardando...' : 'Agregar beneficio'}
                  </button>
                </div>
              </form>
            ) : null}
          </section>

          <section className="portal-alliance-section" aria-labelledby={`${id}-historial`}>
            <h3 id={`${id}-historial`}>Historial</h3>
            <ol className="portal-alliance-timeline">
              {detalle.eventos.map((evento) => (
                <li key={evento.id}>
                  <strong>{evento.accion}</strong>
                  <span>{evento.detalle}</span>
                  <small>{fechaHora(evento.fecha)}{evento.actor_correo ? ` · ${evento.actor_correo}` : ''}</small>
                </li>
              ))}
            </ol>
          </section>
        </>
      ) : null}
    </dialog>
  );
}

function Beneficio({
  recompensa,
  negocioNombre,
}: {
  recompensa: RecompensaAlianza;
  negocioNombre: string;
}) {
  return (
    <li>
      <div>
        <strong>{recompensa.titulo}</strong>
        <p>{recompensa.descripcion}</p>
        <small className="portal-muted">Ofrecido por {negocioNombre}</small>
      </div>
      <div className="portal-alliance-benefit-meta">
        <span className={recompensa.status ? 'portal-badge is-on' : 'portal-badge'}>
          {recompensa.status ? 'Disponible' : 'Inactivo'}
        </span>
        <small>{recompensa.costo_desbloqueo} puntos · {recompensa.vigencia_dias ?? '—'} días</small>
      </div>
    </li>
  );
}
