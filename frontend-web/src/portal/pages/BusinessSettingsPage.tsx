import { PortalPageHeader, PortalForm } from '../components/PortalUI';
import { useRequestGuard } from '../hooks/useRequestGuard';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useAuth } from '../../auth/AuthProvider.tsx';
import { api } from '../../lib/api.ts';
import { membresiaDelNegocio } from '../../lib/portal.ts';
import type { NegocioDetalle } from '../../lib/types.ts';
import { PortalError, PortalLoading } from '../components/PortalState.tsx';
import PlanPanel from '../components/PlanPanel.tsx';
import { usePlan } from '../hooks/usePlan.ts';

export default function BusinessSettingsPage() {
  const { context, refreshContext } = useAuth();
  const { negocioId } = useParams();
  const id = Number(negocioId);
  const membresia = membresiaDelNegocio(context, id);
  const { plan, reload: recargarPlan } = usePlan(id);
  const [negocio, setNegocio] = useState<NegocioDetalle | null>(null);
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
      const respuesta = await api.getBusinessDetail(id);
      if (!vigente()) return;
      setNegocio(respuesta);
    } catch (err) {
      if (!vigente()) return;
      setError(err instanceof Error ? err.message : 'No se pudo cargar el negocio.');
    } finally {
      if (vigente()) setLoading(false);
    }
  }, [requestGuard, id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function actualizar(campo: keyof NegocioDetalle, valor: string) {
    setNegocio((actual) => actual ? { ...actual, [campo]: valor } : actual);
    setOk(null);
  }

  async function guardar(event: FormEvent) {
    event.preventDefault();
    if (!negocio) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const actualizado = await api.updateBusiness(id, {
        nombre: negocio.nombre,
        descripcion: negocio.descripcion ?? '',
        direccion: negocio.direccion,
        telefono: negocio.telefono ?? '',
        correo: negocio.correo,
        logo_url: negocio.logo_url ?? '',
        banner_url: negocio.banner_url ?? '',
        zona_horaria: negocio.zona_horaria,
        categoria: negocio.categoria,
      });
      setNegocio(actualizado);
      setOk('Los datos del negocio se guardaron.');
      await refreshContext();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }

  if (membresia?.rol_comercio !== 'dueno') {
    return <PortalError message="Solo el propietario puede editar el negocio." />;
  }
  if (loading) return <PortalLoading />;
  if (!negocio) return <PortalError message={error ?? 'Negocio no disponible.'} />;

  return (
    <section className="portal-page">
      <PortalPageHeader eyebrow="Configuración" title={<>Datos del negocio</>} description={<>Información pública y de contacto que verán tus clientes.</>}>
        <Link className="portal-button-secondary" to="/registrar-negocio">
          Registrar otro negocio
        </Link>
      </PortalPageHeader>

      {error ? <PortalError message={error} onRetry={() => void cargar()} /> : null}
      {ok ? <div className="portal-note" role="status">{ok}</div> : null}

      <PortalForm onSubmit={guardar}>
        <div className="portal-form-grid">
          <label>
            <span>Nombre comercial</span>
            <input
              value={negocio.nombre}
              onChange={(event) => actualizar('nombre', event.target.value)}
              required
            />
          </label>
          <label>
            <span>Correo del negocio</span>
            <input
              type="email"
              value={negocio.correo}
              onChange={(event) => actualizar('correo', event.target.value)}
              required
            />
          </label>
          <label>
            <span>Teléfono</span>
            <input
              value={negocio.telefono ?? ''}
              onChange={(event) => actualizar('telefono', event.target.value)}
            />
          </label>
          <label>
            <span>Zona horaria</span>
            <input
              value={negocio.zona_horaria}
              onChange={(event) => actualizar('zona_horaria', event.target.value)}
              required
            />
          </label>
          <label className="portal-form-wide">
            <span>Dirección</span>
            <input
              value={negocio.direccion}
              onChange={(event) => actualizar('direccion', event.target.value)}
            />
          </label>
          <label className="portal-form-wide">
            <span>Descripción</span>
            <textarea
              rows={3}
              value={negocio.descripcion ?? ''}
              onChange={(event) => actualizar('descripcion', event.target.value)}
            />
          </label>
          <label>
            <span>URL del logo</span>
            <input
              value={negocio.logo_url ?? ''}
              onChange={(event) => actualizar('logo_url', event.target.value)}
            />
          </label>
          <label>
            <span>URL del banner</span>
            <input
              value={negocio.banner_url ?? ''}
              onChange={(event) => actualizar('banner_url', event.target.value)}
            />
          </label>
        </div>
        <div className="portal-form-actions">
          <span className={negocio.status ? 'portal-badge is-on' : 'portal-badge'}>
            {negocio.status ? 'Negocio activo' : 'Negocio inactivo'}
          </span>
          <button className="portal-button" type="submit" disabled={busy}>
            {busy ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </PortalForm>

      {plan ? <PlanPanel plan={plan} /> : null}
    </section>
  );
}
