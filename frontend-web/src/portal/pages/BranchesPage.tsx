import { useRequestGuard } from '../hooks/useRequestGuard';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useAuth } from '../../auth/AuthProvider.tsx';
import { ApiError, api } from '../../lib/api.ts';
import { membresiaDelNegocio } from '../../lib/portal.ts';
import type { SucursalResumen } from '../../lib/types.ts';
import { PortalError, PortalLoading } from '../components/PortalState.tsx';
import { usePlan } from '../hooks/usePlan.ts';

type Formulario = {
  nombre: string;
  direccion: string;
  ciudad: string;
  telefono: string;
  codigo_postal: string;
  status: boolean;
};

const inicial: Formulario = {
  nombre: '',
  direccion: '',
  ciudad: '',
  telefono: '',
  codigo_postal: '',
  status: true,
};

export default function BranchesPage() {
  const { context, refreshContext } = useAuth();
  const { negocioId } = useParams();
  const id = Number(negocioId);
  const membresia = membresiaDelNegocio(context, id);
  const puedeEditar = membresia?.rol_comercio === 'dueno';
  const { plan, reload: recargarPlan } = usePlan(id);
  const [sucursales, setSucursales] = useState<SucursalResumen[]>([]);
  const [form, setForm] = useState<Formulario>(inicial);
  const [editando, setEditando] = useState<number | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
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
      const datos = await api.getBranches();
      if (!vigente()) return;
      setSucursales(datos.filter((sucursal) => sucursal.negocio === id));
    } catch (err) {
      if (!vigente()) return;
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las sucursales.');
    } finally {
      if (vigente()) setLoading(false);
    }
  }, [requestGuard, id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function abrirNueva() {
    setEditando(null);
    setForm(inicial);
    setMostrarForm(true);
    setError(null);
    setOk(null);
  }

  async function abrirEdicion(sucursal: SucursalResumen) {
    setError(null);
    setOk(null);
    try {
      const detalle = await api.getBranchDetail(sucursal.id);
      setForm({
        nombre: detalle.nombre,
        direccion: detalle.direccion,
        ciudad: detalle.ciudad,
        telefono: detalle.telefono ?? '',
        codigo_postal: detalle.codigo_postal ?? '',
        status: detalle.status,
      });
      setEditando(detalle.id);
      setMostrarForm(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir la sucursal.');
    }
  }

  async function guardar(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    const datos = {
      nombre: form.nombre.trim(),
      direccion: form.direccion.trim(),
      ciudad: form.ciudad.trim(),
      telefono: form.telefono.trim() || undefined,
      codigo_postal: form.codigo_postal.trim() || undefined,
      status: form.status,
      negocio: id,
    };
    try {
      if (editando) {
        await api.updateBranch(editando, datos);
        setOk('Sucursal actualizada.');
      } else {
        await api.createBranch(datos);
        setOk('Sucursal creada.');
      }
      setMostrarForm(false);
      setForm(inicial);
      setEditando(null);
      await Promise.all([cargar(), recargarPlan(), refreshContext()]);
    } catch (err) {
      if (err instanceof ApiError && err.codigo === 'limite_plan') {
        setError(`${err.message} Puedes revisar el plan Premium para ampliar el cupo.`);
      } else {
        setError(err instanceof Error ? err.message : 'No se pudo guardar la sucursal.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function cambiarEstado(sucursal: SucursalResumen) {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await api.updateBranch(sucursal.id, { status: !sucursal.status });
      setOk(sucursal.status ? 'Sucursal desactivada.' : 'Sucursal reactivada.');
      await Promise.all([cargar(), recargarPlan(), refreshContext()]);
    } catch (err) {
      setError(
        err instanceof ApiError && err.codigo === 'limite_plan'
          ? `${err.message} Revisa el plan o desactiva otra sucursal.`
          : err instanceof Error ? err.message : 'No se pudo cambiar el estado.',
      );
    } finally {
      setBusy(false);
    }
  }

  const uso = plan?.limites.sucursales;

  return (
    <section className="portal-page">
      <header className="portal-page-head">
        <div>
          <span className="portal-eyebrow">Negocio</span>
          <h1>Sucursales</h1>
          <p>
            {uso
              ? `${uso.uso} de ${uso.limite ?? '∞'} sucursales activas en tu plan.`
              : 'Sucursales a las que tienes acceso.'}
          </p>
        </div>
        {puedeEditar ? (
          <button className="portal-button" type="button" onClick={abrirNueva}>
            Nueva sucursal
          </button>
        ) : null}
      </header>

      {error ? (
        <div className="portal-state portal-state-error" role="alert">
          <strong>No se pudo completar la operación</strong>
          <p>{error}</p>
          <Link to="/precios">Conocer Premium</Link>
        </div>
      ) : null}
      {ok ? <div className="portal-note" role="status">{ok}</div> : null}

      {mostrarForm && puedeEditar ? (
        <form className="portal-panel portal-form" onSubmit={guardar}>
          <h2>{editando ? 'Editar sucursal' : 'Nueva sucursal'}</h2>
          <div className="portal-form-grid">
            <label>
              <span>Nombre</span>
              <input
                value={form.nombre}
                onChange={(event) => setForm({ ...form, nombre: event.target.value })}
                required
              />
            </label>
            <label>
              <span>Ciudad</span>
              <input
                value={form.ciudad}
                onChange={(event) => setForm({ ...form, ciudad: event.target.value })}
                required
              />
            </label>
            <label className="portal-form-wide">
              <span>Dirección</span>
              <input
                value={form.direccion}
                onChange={(event) => setForm({ ...form, direccion: event.target.value })}
                required
              />
            </label>
            <label>
              <span>Teléfono</span>
              <input
                value={form.telefono}
                onChange={(event) => setForm({ ...form, telefono: event.target.value })}
              />
            </label>
            <label>
              <span>Código postal</span>
              <input
                value={form.codigo_postal}
                onChange={(event) => setForm({ ...form, codigo_postal: event.target.value })}
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
            <button
              type="button"
              className="portal-button-secondary"
              onClick={() => setMostrarForm(false)}
            >
              Cancelar
            </button>
            <button className="portal-button" type="submit" disabled={busy}>
              {busy ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear sucursal'}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? <PortalLoading /> : null}
      {!loading && !error && sucursales.length === 0 ? (
        <div className="portal-state portal-state-empty">
          <p>No hay sucursales todavía.</p>
          {puedeEditar ? (
            <button className="portal-button" type="button" onClick={abrirNueva}>
              Crear la primera sucursal
            </button>
          ) : null}
        </div>
      ) : null}

      {!loading && sucursales.length > 0 ? (
        <div className="portal-panel">
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Sucursal</th><th>Dirección</th><th>Ciudad</th>
                  <th>Estado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sucursales.map((sucursal) => (
                  <tr key={sucursal.id}>
                    <td>{sucursal.nombre}</td>
                    <td>{sucursal.direccion ?? '—'}</td>
                    <td>{sucursal.ciudad ?? '—'}</td>
                    <td>
                      <span className={sucursal.status ? 'portal-badge is-on' : 'portal-badge'}>
                        {sucursal.status ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td>
                      {puedeEditar ? (
                        <div className="portal-row-actions">
                          <button type="button" onClick={() => void abrirEdicion(sucursal)}>
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void cambiarEstado(sucursal)}
                            disabled={busy}
                          >
                            {sucursal.status ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      ) : (
                        <span className="portal-muted">Solo lectura</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
