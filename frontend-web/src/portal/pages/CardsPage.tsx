import { usePortalConfirmation } from '../components/PortalConfirmation';
import { PortalPageHeader, PortalTable, PortalForm, PortalFormSection } from '../components/PortalUI';
import { useRequestGuard } from '../hooks/useRequestGuard';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { useAuth } from '../../auth/AuthProvider.tsx';
import { ApiError, api } from '../../lib/api.ts';
import { membresiaDelNegocio } from '../../lib/portal.ts';
import type { DinamicaResumen, RecompensaResumen } from '../../lib/types.ts';
import { PortalError, PortalLoading } from '../components/PortalState.tsx';
import { usePlan } from '../hooks/usePlan.ts';

function fechaInput(valor: string | null): string {
  return valor ? valor.slice(0, 10) : '';
}

const formInicial = {
  nombre: '',
  descripcion: '',
  meta: '3',
  es_repetible: false,
  fecha_inicio: new Date().toISOString().slice(0, 10),
  fecha_fin: '',
  status: true,
  titulo_premio: 'Premio de la tarjeta',
  descripcion_premio: 'Premio al completar la tarjeta.',
  tipo_premio: 'gratis',
  descuento: '',
  terminos: 'Válido al completar la tarjeta.',
  vigencia_dias: '30',
};

export default function CardsPage() {
  const { context } = useAuth();
  const { confirm, confirmation } = usePortalConfirmation();
  const { negocioId } = useParams();
  const id = Number(negocioId);
  const membresia = membresiaDelNegocio(context, id);
  const puedeEditar = membresia?.rol_comercio === 'dueno';
  const { plan, reload: recargarPlan } = usePlan(id);
  const [tarjetas, setTarjetas] = useState<DinamicaResumen[]>([]);
  const [recompensas, setRecompensas] = useState<RecompensaResumen[]>([]);
  const [form, setForm] = useState({ ...formInicial });
  const [editando, setEditando] = useState<DinamicaResumen | null>(null);
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
      const [dinamicas, premios] = await Promise.all([
        api.getDynamics(),
        api.getRewards(),
      ]);
      if (!vigente()) return;
      setTarjetas(dinamicas.filter(
        (dinamica) => dinamica.negocio === id && dinamica.tipo === 'sellos',
      ));
      if (!vigente()) return;
      setRecompensas(premios.filter(
        (recompensa) => recompensa.negocio === id && recompensa.es_meta,
      ));
    } catch (err) {
      if (!vigente()) return;
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las tarjetas.');
    } finally {
      if (vigente()) setLoading(false);
    }
  }, [requestGuard, id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function premioDe(tarjetaId: number) {
    return recompensas.find((recompensa) => recompensa.dinamica === tarjetaId) ?? null;
  }

  function editar(tarjeta: DinamicaResumen) {
    const premio = premioDe(tarjeta.id);
    setEditando(tarjeta);
    setForm({
      nombre: tarjeta.nombre,
      descripcion: tarjeta.descripcion ?? '',
      meta: String(tarjeta.meta ?? 3),
      es_repetible: tarjeta.es_repetible,
      fecha_inicio: fechaInput(tarjeta.fecha_inicio),
      fecha_fin: fechaInput(tarjeta.fecha_fin),
      status: tarjeta.status,
      titulo_premio: premio?.titulo ?? 'Premio de la tarjeta',
      descripcion_premio: premio?.descripcion ?? '',
      tipo_premio: premio?.tipo ?? 'gratis',
      descuento: premio?.descuento ? String(Number(premio.descuento)) : '',
      terminos: premio?.terminos_condiciones ?? 'Válido al completar la tarjeta.',
      vigencia_dias: premio?.vigencia_dias ? String(premio.vigencia_dias) : '30',
    });
    setError(null);
    setOk(null);
  }

  function nueva() {
    setEditando(null);
    setForm({ ...formInicial });
    setError(null);
    setOk(null);
  }

  function datosPremio() {
    return {
      titulo: form.titulo_premio.trim(),
      descripcion: form.descripcion_premio.trim(),
      tipo: form.tipo_premio,
      descuento: form.tipo_premio === 'gratis'
        ? null : Number(form.descuento || 0),
      terminos_condiciones: form.terminos.trim(),
      vigencia_dias: Number(form.vigencia_dias || 30),
      status: form.status,
    };
  }

  async function guardar(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      if (editando) {
        await api.updateDynamic(editando.id, {
          nombre: form.nombre.trim(),
          descripcion: form.descripcion.trim(),
          tipo: 'sellos',
          meta: Number(form.meta),
          es_repetible: form.es_repetible,
          fecha_inicio: new Date(`${form.fecha_inicio}T00:00:00`).toISOString(),
          fecha_fin: form.fecha_fin
            ? new Date(`${form.fecha_fin}T23:59:59`).toISOString() : null,
          status: form.status,
          negocio: id,
        });
        const premio = premioDe(editando.id);
        if (premio) {
          await api.updateReward(premio.id, datosPremio());
        } else {
          await api.createReward({
            ...datosPremio(),
            negocio: id,
            dinamica: editando.id,
            es_meta: true,
          });
        }
        setOk('Tarjeta actualizada. Los ciclos iniciados conservan sus condiciones.');
      } else {
        await api.createCard(id, {
          nombre: form.nombre.trim(),
          descripcion: form.descripcion.trim(),
          meta: Number(form.meta),
          es_repetible: form.es_repetible,
          fecha_inicio: new Date(`${form.fecha_inicio}T00:00:00`).toISOString(),
          fecha_fin: form.fecha_fin
            ? new Date(`${form.fecha_fin}T23:59:59`).toISOString() : null,
          status: form.status,
          recompensa: datosPremio(),
        });
        setOk('Tarjeta creada con su recompensa meta.');
      }
      setEditando(null);
      await Promise.all([cargar(), recargarPlan()]);
    } catch (err) {
      if (err instanceof ApiError && err.codigo === 'limite_plan') {
        setError(`${err.message} Revisa tu plan o desactiva un recurso.`);
      } else {
        setError(err instanceof Error ? err.message : 'No se pudo guardar la tarjeta.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function cambiarEstado(tarjeta: DinamicaResumen) {
    if (!await confirm({
      title: tarjeta.status ? '\u00bfDesactivar tarjeta?' : '\u00bfActivar tarjeta?',
      action: tarjeta.status ? 'Desactivar' : 'Activar',
      message: tarjeta.status
        ? 'Se impedirán nuevos ciclos. Los ciclos en curso podrán completarse.'
        : 'Se habilitarán nuevos ciclos para esta tarjeta.',
    })) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await api.updateDynamic(tarjeta.id, { status: !tarjeta.status });
      const premio = premioDe(tarjeta.id);
      if (premio) {
        await api.updateReward(premio.id, { status: !tarjeta.status });
      }
      setOk(tarjeta.status ? 'Tarjeta desactivada.' : 'Tarjeta activada.');
      await Promise.all([cargar(), recargarPlan()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado.');
    } finally {
      setBusy(false);
    }
  }

  if (!puedeEditar) {
    return <PortalError message="Solo el propietario puede administrar las tarjetas." />;
  }

  return (
    <section className="portal-page">
      <PortalPageHeader eyebrow="Fidelización" title={<>Tarjetas de sellos</>} description={<>Configura visitas requeridas y la recompensa al completar la tarjeta.</>}>
        <button className="portal-button" type="button" onClick={nueva}>
          Nueva tarjeta
        </button>
      </PortalPageHeader>

      {plan ? (
        <div className="portal-note">
          Tarjetas activas: {plan.limites.tarjetas_sellos.uso} de{' '}
          {plan.limites.tarjetas_sellos.limite ?? '∞'} · Recompensas activas:{' '}
          {plan.limites.recompensas.uso} de {plan.limites.recompensas.limite ?? '∞'}.
        </div>
      ) : null}
      {error ? <PortalError message={error} /> : null}
      {ok ? <div className="portal-note" role="status">{ok}</div> : null}

      <PortalForm onSubmit={guardar}>
        <h2>{editando ? `Editar ${editando.nombre}` : 'Nueva tarjeta'}</h2>
        <PortalFormSection title="Datos de la tarjeta">
          <label>
            <span>Nombre de la tarjeta</span>
            <input
              value={form.nombre}
              onChange={(event) => setForm({ ...form, nombre: event.target.value })}
              required
            />
          </label>
          <label>
            <span>Sellos para completar</span>
            <input
              type="number"
              min="1"
              value={form.meta}
              onChange={(event) => setForm({ ...form, meta: event.target.value })}
              required
            />
          </label>
          <label>
            <span>Inicio</span>
            <input
              type="date"
              value={form.fecha_inicio}
              onChange={(event) => setForm({ ...form, fecha_inicio: event.target.value })}
              required
            />
          </label>
          <label>
            <span>Fin (opcional)</span>
            <input
              type="date"
              value={form.fecha_fin}
              onChange={(event) => setForm({ ...form, fecha_fin: event.target.value })}
            />
          </label>
          <label className="portal-check">
            <input
              type="checkbox"
              checked={form.es_repetible}
              onChange={(event) => setForm({ ...form, es_repetible: event.target.checked })}
            />
            <span>Se puede repetir tras completarla</span>
          </label>
          <label className="portal-check">
            <input
              type="checkbox"
              checked={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.checked })}
            />
            <span>Activa</span>
          </label>
          <label className="portal-form-wide">
            <span>Descripción de la tarjeta</span>
            <textarea
              rows={2}
              value={form.descripcion}
              onChange={(event) => setForm({ ...form, descripcion: event.target.value })}
            />
          </label>
        </PortalFormSection>

        <PortalFormSection title="Recompensa al completar">
          <label>
            <span>Título del premio</span>
            <input
              value={form.titulo_premio}
              onChange={(event) => setForm({ ...form, titulo_premio: event.target.value })}
              required
            />
          </label>
          <label>
            <span>Tipo</span>
            <select
              value={form.tipo_premio}
              onChange={(event) => setForm({ ...form, tipo_premio: event.target.value })}
            >
              <option value="gratis">Producto o servicio gratis</option>
              <option value="descuento">Descuento porcentual</option>
              <option value="descuento_fijo">Descuento de monto fijo</option>
            </select>
          </label>
          {form.tipo_premio !== 'gratis' ? (
            <label>
              <span>{form.tipo_premio === 'descuento' ? 'Porcentaje' : 'Monto'}</span>
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
          <label className="portal-form-wide">
            <span>Descripción del premio</span>
            <textarea
              rows={2}
              value={form.descripcion_premio}
              onChange={(event) => setForm({
                ...form, descripcion_premio: event.target.value,
              })}
              required
            />
          </label>
          <label className="portal-form-wide">
            <span>Términos y condiciones</span>
            <textarea
              rows={2}
              value={form.terminos}
              onChange={(event) => setForm({ ...form, terminos: event.target.value })}
            />
          </label>
        </PortalFormSection>
        <div className="portal-form-actions">
          <button className="portal-button" type="submit" disabled={busy}>
            {busy ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear tarjeta'}
          </button>
        </div>
      </PortalForm>

      {loading ? <PortalLoading /> : null}
      {!loading && tarjetas.length === 0 ? (
        <div className="portal-state portal-state-empty">
          <p>Aún no hay tarjetas de sellos.</p>
        </div>
      ) : null}
      {tarjetas.length > 0 ? (
        <div className="portal-panel">
          <PortalTable label="Listado de tarjetas">
              <thead>
                <tr>
                  <th scope="col">Tarjeta</th><th scope="col">Sellos</th><th scope="col">Repetible</th>
                  <th scope="col">Premio</th><th scope="col">Estado</th><th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tarjetas.map((tarjeta) => {
                  const premio = premioDe(tarjeta.id);
                  return (
                    <tr key={tarjeta.id}>
                      <td>{tarjeta.nombre}</td>
                      <td>{tarjeta.meta}</td>
                      <td>{tarjeta.es_repetible ? 'Sí' : 'No'}</td>
                      <td>{premio?.titulo ?? 'Sin premio'}</td>
                      <td>
                        <span className={tarjeta.status ? 'portal-badge is-on' : 'portal-badge'}>
                          {tarjeta.status ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td>
                        <div className="portal-row-actions">
                          <button type="button" onClick={() => editar(tarjeta)}>Editar</button>
                          <button
                            type="button"
                            onClick={() => void cambiarEstado(tarjeta)}
                            disabled={busy}
                          >
                            {tarjeta.status ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </PortalTable>
        </div>
      ) : null}
      {confirmation}
    </section>
  );
}
