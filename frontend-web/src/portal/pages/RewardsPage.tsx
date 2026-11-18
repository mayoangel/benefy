import { PortalPageHeader, PortalTable, PortalForm } from '../components/PortalUI';
import { useRequestGuard } from '../hooks/useRequestGuard';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import { useAuth } from '../../auth/AuthProvider.tsx';
import { ApiError, api } from '../../lib/api.ts';
import { membresiaDelNegocio } from '../../lib/portal.ts';
import type { RecompensaResumen } from '../../lib/types.ts';
import { PortalError, PortalLoading } from '../components/PortalState.tsx';
import { usePlan } from '../hooks/usePlan.ts';

const formInicial = {
  titulo: '',
  descripcion: '',
  tipo: 'gratis',
  descuento: '',
  costo_desbloqueo: '0',
  terminos: '',
  vigencia_dias: '30',
  cantidad_disponible: '',
  status: true,
};

export default function RewardsPage() {
  const { context } = useAuth();
  const { negocioId } = useParams();
  const id = Number(negocioId);
  const membresia = membresiaDelNegocio(context, id);
  const puedeEditar = membresia?.rol_comercio === 'dueno';
  const { plan, reload: recargarPlan } = usePlan(id);
  const [showForm, setShowForm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (showForm) formRef.current?.querySelector<HTMLInputElement>('input')?.focus(); }, [showForm]);
  const [recompensas, setRecompensas] = useState<RecompensaResumen[]>([]);
  const [form, setForm] = useState({ ...formInicial });
  const [editando, setEditando] = useState<RecompensaResumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const requestGuard = useRequestGuard(Number(negocioId));
  const cargar = useCallback(async () => {
    const vigente = requestGuard();
    setLoading(true);
    setError(null);
    try {
      const datos = await api.getRewards();
      if (!vigente()) return;
      setRecompensas(datos.filter(
        (recompensa) => recompensa.negocio === id && !recompensa.es_meta,
      ));
    } catch (err) {
      if (!vigente()) return;
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las recompensas.');
    } finally {
      if (vigente()) setLoading(false);
    }
  }, [requestGuard, id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function editar(recompensa: RecompensaResumen) {
    setShowForm(true);
    setEditando(recompensa);
    setForm({
      titulo: recompensa.titulo,
      descripcion: recompensa.descripcion,
      tipo: recompensa.tipo,
      descuento: recompensa.descuento ? String(Number(recompensa.descuento)) : '',
      costo_desbloqueo: String(recompensa.costo_desbloqueo),
      terminos: recompensa.terminos_condiciones,
      vigencia_dias: recompensa.vigencia_dias
        ? String(recompensa.vigencia_dias) : '30',
      cantidad_disponible: recompensa.cantidad_disponible
        ? String(recompensa.cantidad_disponible) : '',
      status: recompensa.status,
    });
    setError(null);
    setOk(null);
  }

  function nueva() {
    setShowForm(true);
    setEditando(null);
    setForm({ ...formInicial });
    setError(null);
    setOk(null);
  }

  async function guardar(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    const datos = {
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim(),
      tipo: form.tipo,
      descuento: form.tipo === 'gratis' ? null : Number(form.descuento || 0),
      costo_desbloqueo: Number(form.costo_desbloqueo || 0),
      terminos_condiciones: form.terminos.trim(),
      vigencia_dias: Number(form.vigencia_dias || 30),
      cantidad_disponible: form.cantidad_disponible
        ? Number(form.cantidad_disponible) : null,
      status: form.status,
      negocio: id,
    };
    try {
      if (editando) {
        await api.updateReward(editando.id, datos);
        setOk('Recompensa actualizada. Los cupones ya emitidos se conservan.');
      } else {
        await api.createReward(datos);
        setOk('Recompensa creada.');
      }
      setEditando(null);
      setShowForm(false);
      setForm({...formInicial});
      await Promise.all([cargar(), recargarPlan()]);
    } catch (err) {
      if (err instanceof ApiError && err.codigo === 'limite_plan') {
        setError(`${err.message} Revisa tu plan o desactiva una recompensa.`);
      } else {
        setError(err instanceof Error ? err.message : 'No se pudo guardar la recompensa.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function cambiarEstado(recompensa: RecompensaResumen) {
    if (!window.confirm(
      recompensa.status
        ? 'La recompensa dejará de estar disponible, pero los cupones emitidos se conservan.'
        : 'La recompensa volverá a estar disponible según su vigencia.',
    )) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await api.updateReward(recompensa.id, { status: !recompensa.status });
      setOk(recompensa.status ? 'Recompensa desactivada.' : 'Recompensa activada.');
      await Promise.all([cargar(), recargarPlan()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado.');
    } finally {
      setBusy(false);
    }
  }

  if (!puedeEditar) {
    return <PortalError message="Solo el propietario puede administrar recompensas." />;
  }

  return (
    <section className="portal-page">
      <PortalPageHeader eyebrow="Fidelización" title={<>Recompensas</>} description={<>Beneficios que los clientes pueden adquirir con puntos.</>}>
        <button className="portal-button" type="button" onClick={nueva}>
          Nueva recompensa
        </button>
      </PortalPageHeader>

      {plan ? (
        <div className="portal-note">
          Recompensas activas: {plan.limites.recompensas.uso} de{' '}
          {plan.limites.recompensas.limite ?? '∞'}. Las recompensas meta de tarjetas
          también cuentan.
        </div>
      ) : null}
      {error ? <PortalError message={error} /> : null}
      {ok ? <div className="portal-note" role="status">{ok}</div> : null}

      {showForm ? <PortalForm ref={formRef} onSubmit={guardar}>
        <h2>{editando ? `Editar ${editando.titulo}` : 'Nueva recompensa'}</h2>
        <div className="portal-form-grid">
          <label>
            <span>Título</span>
            <input
              value={form.titulo}
              onChange={(event) => setForm({ ...form, titulo: event.target.value })}
              required
            />
          </label>
          <label>
            <span>Costo en puntos</span>
            <input
              type="number"
              min="0"
              value={form.costo_desbloqueo}
              onChange={(event) => setForm({
                ...form, costo_desbloqueo: event.target.value,
              })}
              required
            />
          </label>
          <label>
            <span>Tipo</span>
            <select
              value={form.tipo}
              onChange={(event) => setForm({ ...form, tipo: event.target.value })}
            >
              <option value="gratis">Producto o servicio gratis</option>
              <option value="descuento">Descuento porcentual</option>
              <option value="descuento_fijo">Descuento de monto fijo</option>
            </select>
          </label>
          {form.tipo !== 'gratis' ? (
            <label>
              <span>{form.tipo === 'descuento' ? 'Porcentaje' : 'Monto'}</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.descuento}
                onChange={(event) => setForm({ ...form, descuento: event.target.value })}
                required
              />
            </label>
          ) : null}
          <label>
            <span>Vigencia del cupón (días)</span>
            <input
              type="number"
              min="1"
              value={form.vigencia_dias}
              onChange={(event) => setForm({ ...form, vigencia_dias: event.target.value })}
              required
            />
          </label>
          <label>
            <span>Stock (vacío = ilimitado)</span>
            <input
              type="number"
              min="0"
              value={form.cantidad_disponible}
              onChange={(event) => setForm({
                ...form, cantidad_disponible: event.target.value,
              })}
            />
          </label>
          <label className="portal-form-wide">
            <span>Descripción</span>
            <textarea
              rows={2}
              value={form.descripcion}
              onChange={(event) => setForm({ ...form, descripcion: event.target.value })}
              required
            />
          </label>
          <label className="portal-form-wide">
            <span>Términos y condiciones</span>
            <textarea
              rows={2}
              value={form.terminos}
              onChange={(event) => setForm({ ...form, terminos: event.target.value })}
              required
            />
          </label>
          <label className="portal-check">
            <input
              type="checkbox"
              checked={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.checked })}
            />
            <span>Activa</span>
          </label>
        </div>
        <div className="portal-form-actions">
          <button type="button" className="portal-button-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
          <button className="portal-button" type="submit" disabled={busy}>
            {busy ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear recompensa'}
          </button>
        </div>
      </PortalForm> : null}

      {loading ? <PortalLoading /> : null}
      {!loading && recompensas.length === 0 ? (
        <div className="portal-state portal-state-empty">
          <p>Aún no hay recompensas configurables.</p>
        </div>
      ) : null}
      {recompensas.length > 0 ? (
        <div className="portal-panel">
          <PortalTable label="Listado de recompensas">
              <thead>
                <tr>
                  <th scope="col">Recompensa</th><th scope="col">Tipo</th><th scope="col">Puntos</th>
                  <th scope="col">Vigencia</th><th scope="col">Stock</th><th scope="col">Estado</th><th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {recompensas.map((recompensa) => (
                  <tr key={recompensa.id}>
                    <td>{recompensa.titulo}</td>
                    <td>{recompensa.tipo}</td>
                    <td>{recompensa.costo_desbloqueo}</td>
                    <td>{recompensa.vigencia_dias ?? 0} días</td>
                    <td>{recompensa.cantidad_disponible ?? 'Ilimitado'}</td>
                    <td>
                      <span className={recompensa.status ? 'portal-badge is-on' : 'portal-badge'}>
                        {recompensa.status ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td>
                      <div className="portal-row-actions">
                        <button type="button" onClick={() => editar(recompensa)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void cambiarEstado(recompensa)}
                          disabled={busy}
                        >
                          {recompensa.status ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </PortalTable>
        </div>
      ) : null}
    </section>
  );
}
