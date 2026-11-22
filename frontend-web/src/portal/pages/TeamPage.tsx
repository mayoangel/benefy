import { usePortalConfirmation } from '../components/PortalConfirmation';
import { PortalPageHeader, PortalTable, PortalForm, PortalRoleBadge } from '../components/PortalUI';
import { useRequestGuard } from '../hooks/useRequestGuard';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { useAuth } from '../../auth/AuthProvider.tsx';
import { ApiError, api } from '../../lib/api.ts';
import { membresiaDelNegocio } from '../../lib/portal.ts';
import type {
  InvitacionResumen,
  MembresiaResumen,
  SucursalResumen,
} from '../../lib/types.ts';
import { PortalEmpty, PortalError, PortalLoading } from '../components/PortalState.tsx';
import { usePlan } from '../hooks/usePlan.ts';

export default function TeamPage() {
  const { context, profile } = useAuth();
  const { confirm, confirmation } = usePortalConfirmation();
  const { negocioId } = useParams();
  const id = Number(negocioId);
  const membresia = membresiaDelNegocio(context, id);
  const esDueno = membresia?.rol_comercio === 'dueno';
  const esSupervisor = membresia?.rol_comercio === 'supervisor';
  const { plan, reload: recargarPlan } = usePlan(id);
  const [filas, setFilas] = useState<MembresiaResumen[]>([]);
  const [invitaciones, setInvitaciones] = useState<InvitacionResumen[]>([]);
  const [sucursales, setSucursales] = useState<SucursalResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [invitando, setInvitando] = useState(false);
  const [form, setForm] = useState({
    correo: '',
    rol_comercio: 'empleado',
    sucursal: '',
    motivo: '',
  });
  const [editando, setEditando] = useState<MembresiaResumen | null>(null);
  const [edicion, setEdicion] = useState({ rol_comercio: 'empleado', sucursal: '', status: true });

  const requestGuard = useRequestGuard(Number(negocioId));
  const cargar = useCallback(async () => {
    const vigente = requestGuard();
    setLoading(true);
    setError(null);
    try {
      const [membresias, ramas, invitacionesData] = await Promise.all([
        api.getMemberships(), api.getBranches(),
        esDueno || esSupervisor
          ? api.getInvitations(id).then(data => ({data, error: null as string | null}))
              .catch(err => ({data: [] as InvitacionResumen[], error: err instanceof Error ? err.message : 'No se pudieron cargar las invitaciones.'}))
          : Promise.resolve({data: [] as InvitacionResumen[], error: null}),
      ]);
      if (!vigente()) return;
      setFilas(membresias.filter((fila) => fila.negocio === id));
      setSucursales(ramas.filter((rama) => rama.negocio === id));
      setInvitaciones(invitacionesData.data);
      setInvitationError(invitacionesData.error);
    } catch (err) {
      if (!vigente()) return;
      setError(err instanceof Error ? err.message : 'No se pudo cargar el equipo.');
    } finally {
      if (vigente()) setLoading(false);
    }
  }, [requestGuard, esDueno, esSupervisor, id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const sucursalPropia = membresia?.sucursal?.id
    ? String(membresia.sucursal.id) : '';
  const sucursalesDisponibles = esDueno
    ? sucursales
    : sucursales.filter((sucursal) => String(sucursal.id) === sucursalPropia);
  const rolesDisponibles = esDueno
    ? [
        { valor: 'supervisor', texto: 'Supervisor' },
        { valor: 'empleado', texto: 'Empleado' },
      ]
    : [{ valor: 'empleado', texto: 'Empleado' }];

  useEffect(() => {
    if (!form.sucursal && sucursalesDisponibles[0]) {
      setForm((actual) => ({
        ...actual,
        sucursal: String(sucursalesDisponibles[0].id),
      }));
    }
  }, [form.sucursal, sucursalesDisponibles]);

  async function invitar(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const nueva = await api.createInvitation(id, {
        correo: form.correo.trim(),
        rol_comercio: form.rol_comercio,
        sucursal: form.sucursal ? Number(form.sucursal) : null,
        motivo: form.motivo.trim(),
      });
      setInvitaciones((actual) => [nueva, ...actual]);
      setForm({
        correo: '',
        rol_comercio: 'empleado',
        sucursal: form.sucursal,
        motivo: '',
      });
      setInvitando(false);
      setOk('Invitación creada. Comparte el enlace; la membresía se activará al aceptarla.');
      await recargarPlan();
    } catch (err) {
      setError(
        err instanceof ApiError && err.codigo === 'limite_plan'
          ? `${err.message} Revisa el plan o desactiva una membresía.`
          : err instanceof Error ? err.message : 'No se pudo crear la invitación.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function revocar(invitacion: InvitacionResumen) {
    if (!await confirm({ title: '¿Revocar invitación?', action: 'Revocar', message: 'La invitación dejará de ser válida.' })) return;
    setBusy(true);
    setError(null);
    try {
      const actualizada = await api.revokeInvitation(invitacion.token);
      setInvitaciones((actual) => actual.map(
        (item) => item.token === actualizada.token ? actualizada : item,
      ));
      setOk('Invitación revocada.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo revocar.');
    } finally {
      setBusy(false);
    }
  }

  function abrirEdicion(fila: MembresiaResumen) {
    setEditando(fila);
    setEdicion({
      rol_comercio: fila.rol_comercio,
      sucursal: fila.sucursal ? String(fila.sucursal) : '',
      status: fila.status,
    });
    setError(null);
    setOk(null);
  }

  async function guardarEdicion(event: FormEvent) {
    event.preventDefault();
    if (!editando) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await api.updateMembership(editando.id, {
        rol_comercio: edicion.rol_comercio,
        sucursal: edicion.sucursal ? Number(edicion.sucursal) : null,
        status: edicion.status,
      });
      setEditando(null);
      setOk('Membresía actualizada y auditada.');
      await Promise.all([cargar(), recargarPlan()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la membresía.');
    } finally {
      setBusy(false);
    }
  }

  function enlace(token: string) {
    return `${window.location.origin}/invitacion/${token}`;
  }

  async function copiar(token: string) {
    try {
      await navigator.clipboard.writeText(enlace(token));
      setOk('Enlace copiado.');
    } catch {
      setError('No se pudo copiar. Selecciona el enlace manualmente.');
    }
  }

  if (membresia?.rol_comercio === 'empleado') {
    return <PortalError message="No tienes permisos para consultar el equipo." />;
  }

  return (
    <section className="portal-page">
      <PortalPageHeader eyebrow="Equipo" title="Membresías y accesos" description={<>Invita personas y controla su rol, sucursal y estado.</>}>
        <button
          className="portal-button"
          type="button"
          onClick={() => setInvitando((valor) => !valor)}
        >
          Invitar persona
        </button>
      </PortalPageHeader>

      {plan ? (
        <div className="portal-note">
          Supervisores: {plan.limites.supervisores.uso} de{' '}
          {plan.limites.supervisores.limite ?? '∞'} · Empleados:{' '}
          {plan.limites.empleados.uso} de {plan.limites.empleados.limite ?? '∞'}.
        </div>
      ) : null}
      {error ? <PortalError message={error} /> : null}
      {ok ? <div className="portal-note" role="status">{ok}</div> : null}

      {invitando ? (
        <PortalForm onSubmit={invitar}>
          <h2>Nueva invitación</h2>
          <p className="portal-muted">
            La persona debe iniciar sesión con el mismo correo y aceptar la
            invitación. No se concede acceso antes de aceptarla.
          </p>
          <div className="portal-form-grid">
            <label htmlFor="portal-team-1">
              <span>Correo electrónico</span>
              <input id="portal-team-1" name="correo"
                type="email" autoComplete="email" autoFocus
                value={form.correo}
                onChange={(event) => setForm({ ...form, correo: event.target.value })}
                required
              />
            </label>
            <label htmlFor="portal-team-2">
              <span>Rol</span>
              <select id="portal-team-2" name="rol_comercio"
                value={form.rol_comercio}
                onChange={(event) => setForm({ ...form, rol_comercio: event.target.value })}
              >
                {rolesDisponibles.map((rol) => (
                  <option key={rol.valor} value={rol.valor}>{rol.texto}</option>
                ))}
              </select>
            </label>
            <label htmlFor="portal-team-3">
              <span>Sucursal</span>
              <select id="portal-team-3" name="sucursal"
                value={form.sucursal}
                onChange={(event) => setForm({ ...form, sucursal: event.target.value })}
                required
              >
                <option value="">Selecciona una sucursal</option>
                {sucursalesDisponibles.map((sucursal) => (
                  <option key={sucursal.id} value={sucursal.id}>{sucursal.nombre}</option>
                ))}
              </select>
            </label>
            <label className="portal-form-wide" htmlFor="portal-team-4">
              <span>Motivo (opcional)</span>
              <input id="portal-team-4" name="motivo"
                value={form.motivo}
                onChange={(event) => setForm({ ...form, motivo: event.target.value })}
              />
            </label>
          </div>
          <div className="portal-form-actions">
            <button
              type="button"
              className="portal-button-secondary"
              onClick={() => setInvitando(false)}
            >
              Cancelar
            </button>
            <button className="portal-button" type="submit" disabled={busy}>
              {busy ? 'Enviando...' : 'Crear invitación'}
            </button>
          </div>
        </PortalForm>
      ) : null}

      {editando ? (
        <PortalForm onSubmit={guardarEdicion}>
          <h2>Editar membresía</h2>
          <div className="portal-form-grid">
            <label htmlFor="portal-team-5">
              <span>Rol</span>
              <select id="portal-team-5" name="rol_comercio"
                autoFocus
                value={edicion.rol_comercio}
                onChange={(event) => setEdicion({
                  ...edicion, rol_comercio: event.target.value,
                })}
              >
                {rolesDisponibles.map((rol) => (
                  <option key={rol.valor} value={rol.valor}>{rol.texto}</option>
                ))}
              </select>
            </label>
            <label htmlFor="portal-team-6">
              <span>Sucursal</span>
              <select id="portal-team-6" name="sucursal"
                value={edicion.sucursal}
                onChange={(event) => setEdicion({
                  ...edicion, sucursal: event.target.value,
                })}
                required
              >
                <option value="">Selecciona una sucursal</option>
                {sucursalesDisponibles.map((sucursal) => (
                  <option key={sucursal.id} value={sucursal.id}>{sucursal.nombre}</option>
                ))}
              </select>
            </label>
            <label className="portal-check" htmlFor="portal-team-7">
              <input id="portal-team-7" name="status"
                type="checkbox"
                checked={edicion.status}
                onChange={(event) => setEdicion({
                  ...edicion, status: event.target.checked,
                })}
              />
              <span>Activa</span>
            </label>
          </div>
          <div className="portal-form-actions">
            <button
              type="button"
              className="portal-button-secondary"
              onClick={() => setEditando(null)}
            >
              Cancelar
            </button>
            <button className="portal-button" type="submit" disabled={busy}>
              {busy ? 'Guardando...' : 'Guardar membresía'}
            </button>
          </div>
        </PortalForm>
      ) : null}

      {invitationError ? <PortalError message={invitationError} onRetry={() => void cargar()} /> : null}
      {loading ? <PortalLoading /> : null}
      {!loading && !error && filas.length === 0 ? (
        <PortalEmpty message="No hay membresías visibles." />
      ) : null}

      {!loading && filas.length > 0 ? (
        <div className="portal-panel">
          <h2>Membresías</h2>
          <PortalTable label="Listado de membresías">
              <thead>
                <tr>
                  <th scope="col">Usuario</th><th scope="col">Correo</th><th scope="col">Rol</th>
                  <th scope="col">Sucursal</th><th scope="col">Estado</th><th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((fila) => {
                  const esPropietario = fila.rol_comercio === 'dueno';
                  const propio = fila.usuario === profile?.id;
                  return (
                    <tr key={fila.id} className={propio ? 'is-current' : ''}>
                      <td>{fila.usuario_nombre ?? `Usuario #${fila.usuario}`}</td>
                      <td className="portal-contact">{fila.usuario_correo ?? '—'}</td>
                      <td><PortalRoleBadge role={fila.rol_comercio} /></td>
                      <td>{fila.sucursal_nombre ?? 'Todo el negocio'}</td>
                      <td>
                        <span className={fila.status ? 'portal-badge is-on' : 'portal-badge'}>
                          {fila.status ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td>
                        {esPropietario ? (
                          <span className="portal-muted">Propietario</span>
                        ) : (
                          <div className="portal-row-actions">
                            <button type="button" onClick={() => abrirEdicion(fila)}>
                              Editar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </PortalTable>
        </div>
      ) : null}

      {invitaciones.length > 0 ? (
        <div className="portal-panel">
          <h2>Invitaciones</h2>
          <PortalTable label="Listado de invitaciones">
              <thead>
                <tr>
                  <th scope="col">Correo</th><th scope="col">Rol</th><th scope="col">Sucursal</th>
                  <th scope="col">Estado</th><th scope="col">Expira</th><th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {invitaciones.map((invitacion) => (
                  <tr key={invitacion.token}>
                    <td className="portal-contact">{invitacion.correo}</td>
                    <td><PortalRoleBadge role={invitacion.rol_comercio} /></td>
                    <td>{invitacion.sucursal?.nombre ?? 'Todo el negocio'}</td>
                    <td>
                      <span className={invitacion.estado === 'pendiente'
                        ? 'portal-badge is-soon' : 'portal-badge'}>
                        {invitacion.estado}
                      </span>
                    </td>
                    <td>{new Date(invitacion.fecha_expiracion).toLocaleDateString('es-MX')}</td>
                    <td>
                      {invitacion.estado === 'pendiente' ? (
                        <div className="portal-row-actions">
                          <button type="button" onClick={() => void copiar(invitacion.token)}>
                            Copiar enlace
                          </button>
                          <button
                            type="button"
                            onClick={() => void revocar(invitacion)}
                            disabled={busy}
                          >
                            Revocar
                          </button>
                        </div>
                      ) : (
                        <span className="portal-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </PortalTable>
          <p className="portal-muted">
            Enlace de ejemplo: {enlace(invitaciones[0].token)}
          </p>
        </div>
      ) : null}
      {confirmation}
    </section>
  );
}
