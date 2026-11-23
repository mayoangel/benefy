import { PortalPageHeader, PortalTable, PortalForm } from '../components/PortalUI';
import { useRequestGuard } from '../hooks/useRequestGuard';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useAuth } from '../../auth/AuthProvider.tsx';
import { ApiError, api } from '../../lib/api.ts';
import { membresiaDelNegocio } from '../../lib/portal.ts';
import type { DinamicaResumen } from '../../lib/types.ts';
import { PortalEmpty, PortalError, PortalLoading } from '../components/PortalState.tsx';
import { usePlan } from '../hooks/usePlan.ts';

function fechaInput(valor: string | null): string {
  if (!valor) return '';
  return valor.slice(0, 10);
}

export default function PointsPage() {
  const { context } = useAuth();
  const { negocioId } = useParams();
  const id = Number(negocioId);
  const membresia = membresiaDelNegocio(context, id);
  const puedeEditar = membresia?.rol_comercio === 'dueno';
  const { plan, reload: recargarPlan } = usePlan(id);
  const [programas, setProgramas] = useState<DinamicaResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [editando, setEditando] = useState<DinamicaResumen | null>(null);
  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    regla_conversion: '1',
    dias_expiracion_puntos: '',
    fecha_inicio: new Date().toISOString().slice(0, 10),
    fecha_fin: '',
    status: true,
  });

  const requestGuard = useRequestGuard(Number(negocioId));
  const cargar = useCallback(async () => {
    const vigente = requestGuard();
    setLoading(true);
    setError(null);
    try {
      const datos = await api.getDynamics();
      if (!vigente()) return;
      setProgramas(datos.filter(
        (dinamica) => dinamica.negocio === id && dinamica.tipo === 'puntos',
      ));
    } catch (err) {
      if (!vigente()) return;
      setError(err instanceof Error ? err.message : 'No se pudo cargar el programa.');
    } finally {
      if (vigente()) setLoading(false);
    }
  }, [requestGuard, id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function editar(programa: DinamicaResumen) {
    setEditando(programa);
    setForm({
      nombre: programa.nombre,
      descripcion: programa.descripcion ?? '',
      regla_conversion: String(Number(programa.regla_conversion ?? 1)),
      dias_expiracion_puntos: programa.dias_expiracion_puntos
        ? String(programa.dias_expiracion_puntos) : '',
      fecha_inicio: fechaInput(programa.fecha_inicio),
      fecha_fin: fechaInput(programa.fecha_fin),
      status: programa.status,
    });
    setError(null);
    setOk(null);
  }

  function nuevo() {
    setEditando(null);
    setForm({
      nombre: '',
      descripcion: '',
      regla_conversion: '1',
      dias_expiracion_puntos: '',
      fecha_inicio: new Date().toISOString().slice(0, 10),
      fecha_fin: '',
      status: true,
    });
    setError(null);
    setOk(null);
  }

  async function guardar(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    const datos = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
      tipo: 'puntos',
      regla_conversion: Number(form.regla_conversion),
      dias_expiracion_puntos: form.dias_expiracion_puntos
        ? Number(form.dias_expiracion_puntos) : null,
      fecha_inicio: new Date(`${form.fecha_inicio}T00:00:00`).toISOString(),
      fecha_fin: form.fecha_fin
        ? new Date(`${form.fecha_fin}T23:59:59`).toISOString() : null,
      status: form.status,
      negocio: id,
    };
    try {
      if (editando) {
        await api.updateDynamic(editando.id, datos);
        setOk('Programa de puntos actualizado. Los puntos ya otorgados no cambian.');
      } else {
        await api.createDynamic(datos);
        setOk('Programa de puntos creado.');
      }
      setEditando(null);
      await Promise.all([cargar(), recargarPlan()]);
    } catch (err) {
      setError(
        err instanceof ApiError && err.codigo === 'limite_plan'
          ? `${err.message} Tu plan permite un programa de puntos.`
          : err instanceof Error ? err.message : 'No se pudo guardar el programa.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function cambiarEstado(programa: DinamicaResumen) {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await api.updateDynamic(programa.id, { status: !programa.status });
      setOk(programa.status ? 'Programa desactivado.' : 'Programa activado.');
      await Promise.all([cargar(), recargarPlan()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado.');
    } finally {
      setBusy(false);
    }
  }

  if (membresia?.rol_comercio !== 'dueno') {
    return <PortalError message="Solo el propietario puede configurar los puntos." />;
  }

  return (
    <section className="portal-page">
      <PortalPageHeader eyebrow="Fidelización" title="Programa de puntos" description={<>Un programa activo por negocio. Los puntos históricos no se recalculan.</>}>
        <Link className="portal-button-secondary" to={`/portal/negocio/${id}/recompensas`}>
          Ver recompensas
        </Link>
        <button className="portal-button" type="button" onClick={nuevo}>
          Nuevo programa
        </button>
      </PortalPageHeader>

      {plan ? (
        <div className="portal-note">
          Plan {plan.plan.nombre}: {plan.limites.programas_puntos.uso} de{' '}
          {plan.limites.programas_puntos.limite ?? '∞'} programas activos.
        </div>
      ) : null}
      {error ? <PortalError message={error} /> : null}
      {ok ? <div className="portal-note" role="status">{ok}</div> : null}

      <PortalForm onSubmit={guardar}>
        <h2>{editando ? `Editar ${editando.nombre}` : 'Configurar programa'}</h2>
        <div className="portal-form-grid">
          <label htmlFor="portal-points-1">
            <span>Nombre</span>
            <input id="portal-points-1" name="nombre"
              value={form.nombre}
              onChange={(event) => setForm({ ...form, nombre: event.target.value })}
              required
            />
          </label>
          <label htmlFor="portal-points-2">
            <span>Puntos por visita</span>
            <input id="portal-points-2" name="regla_conversion"
              type="number"
              min="1"
              step="1"
              value={form.regla_conversion}
              onChange={(event) => setForm({ ...form, regla_conversion: event.target.value })}
              required
            />
          </label>
          <label htmlFor="portal-points-3">
            <span>Vigencia de puntos (días, opcional)</span>
            <input id="portal-points-3" name="dias_expiracion_puntos"
              type="number"
              min="1"
              value={form.dias_expiracion_puntos}
              onChange={(event) => setForm({
                ...form, dias_expiracion_puntos: event.target.value,
              })}
            />
          </label>
          <label htmlFor="portal-points-4">
            <span>Inicio</span>
            <input id="portal-points-4" name="fecha_inicio"
              type="date"
              value={form.fecha_inicio}
              onChange={(event) => setForm({ ...form, fecha_inicio: event.target.value })}
              required
            />
          </label>
          <label htmlFor="portal-points-5">
            <span>Fin (opcional)</span>
            <input id="portal-points-5" name="fecha_fin"
              type="date"
              value={form.fecha_fin}
              onChange={(event) => setForm({ ...form, fecha_fin: event.target.value })}
            />
          </label>
          <label className="portal-form-wide" htmlFor="portal-points-6">
            <span>Descripción</span>
            <textarea id="portal-points-6" name="descripcion"
              rows={2}
              value={form.descripcion}
              onChange={(event) => setForm({ ...form, descripcion: event.target.value })}
            />
          </label>
          <label className="portal-check" htmlFor="portal-points-7">
            <input id="portal-points-7" name="status"
              type="checkbox"
              checked={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.checked })}
            />
            <span>Activo</span>
          </label>
        </div>
        <div className="portal-form-actions">
          <button className="portal-button" type="submit" disabled={busy}>
            {busy ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear programa'}
          </button>
        </div>
      </PortalForm>

      {loading ? <PortalLoading /> : null}
      {!loading && programas.length === 0 ? (
        <PortalEmpty message="Aún no hay un programa de puntos. Crea el primero para empezar." />
      ) : null}
      {programas.length > 0 ? (
        <div className="portal-panel">
          <PortalTable label="Listado de puntos">
              <thead>
                <tr>
                  <th scope="col">Programa</th><th scope="col">Puntos/visita</th><th scope="col">Vigencia</th>
                  <th scope="col">Estado</th><th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {programas.map((programa) => (
                  <tr key={programa.id}>
                    <td>{programa.nombre}</td>
                    <td>{Number(programa.regla_conversion ?? 0)}</td>
                    <td>{programa.dias_expiracion_puntos ?? 'Sin caducidad'}</td>
                    <td>
                      <span className={programa.status ? 'portal-badge is-on' : 'portal-badge'}>
                        {programa.status ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div className="portal-row-actions">
                        <button type="button" onClick={() => editar(programa)}>Editar</button>
                        <button
                          type="button"
                          onClick={() => void cambiarEstado(programa)}
                          disabled={busy}
                        >
                          {programa.status ? 'Desactivar' : 'Activar'}
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
