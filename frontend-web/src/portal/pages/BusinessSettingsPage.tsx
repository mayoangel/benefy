import { PortalPageHeader, PortalForm, PortalFormSection } from '../components/PortalUI';
import { useRequestGuard } from '../hooks/useRequestGuard';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useAuth } from '../../auth/AuthProvider.tsx';
import { api } from '../../lib/api.ts';
import { membresiaDelNegocio } from '../../lib/portal.ts';
import type { NegocioDetalle } from '../../lib/types.ts';
import BranchQRDialog from '../components/BranchQRDialog.tsx';
import { PortalError, PortalLoading } from '../components/PortalState.tsx';
import PlanPanel from '../components/PlanPanel.tsx';
import { usePlan } from '../hooks/usePlan.ts';

function firmaNegocio(negocio: NegocioDetalle) {
  return JSON.stringify({
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
}

export default function BusinessSettingsPage() {
  const { context, refreshContext } = useAuth();
  const { negocioId } = useParams();
  const id = Number(negocioId);
  const membresia = membresiaDelNegocio(context, id);
  const { plan, reload: recargarPlan } = usePlan(id);
  const [negocio, setNegocio] = useState<NegocioDetalle | null>(null);
  const [original, setOriginal] = useState<NegocioDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [mostrarQr, setMostrarQr] = useState(false);
  const dirty = Boolean(negocio && original && firmaNegocio(negocio) !== firmaNegocio(original));
  const { confirmClose } = useUnsavedChanges(dirty);

  const requestGuard = useRequestGuard(Number(negocioId));
  const cargar = useCallback(async () => {
    const vigente = requestGuard();
    setLoading(true);
    setError(null);
    try {
      const respuesta = await api.getBusinessDetail(id);
      if (!vigente()) return;
      setNegocio(respuesta);
      setOriginal(respuesta);
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
      setOriginal(actualizado);
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
      <PortalPageHeader eyebrow="Administración" title="Datos del negocio" description={<>Información pública y de contacto que verán tus clientes.</>}>
        <button
          className="portal-button-secondary"
          type="button"
          onClick={() => setMostrarQr(true)}
          disabled={!negocio.qr_uuid}
        >
          Ver QR del negocio
        </button>
        <Link className="portal-button-secondary" to={`/portal/negocio/${negocio.id}/sucursales`}>
          Gestionar sucursales
        </Link>
      </PortalPageHeader>

      {error ? <PortalError message={error} onRetry={() => void cargar()} /> : null}
      {ok ? <div className="portal-note" role="status">{ok}</div> : null}

      <PortalForm onSubmit={guardar}>
        <PortalFormSection title="Identidad del negocio" description="El nombre y la descripción que conocen tus clientes.">
<label htmlFor="portal-businesssettings-1">
            <span>Nombre comercial</span>
            <input id="portal-businesssettings-1" name="nombre"
              value={negocio.nombre}
              onChange={(event) => actualizar('nombre', event.target.value)}
              required
            />
          </label>
<label className="portal-form-wide" htmlFor="portal-businesssettings-2">
            <span>Descripción</span>
            <textarea id="portal-businesssettings-2" name="descripcion"
              rows={3}
              value={negocio.descripcion ?? ''}
              onChange={(event) => actualizar('descripcion', event.target.value)}
            />
          </label>
        </PortalFormSection>
        <PortalFormSection title="Ubicación y contacto" description="Mantén tus datos de contacto y zona horaria actualizados.">
<label htmlFor="portal-businesssettings-3">
            <span>Correo del negocio</span>
            <input id="portal-businesssettings-3" name="correo"
              type="email" autoComplete="section-business email"
              value={negocio.correo}
              onChange={(event) => actualizar('correo', event.target.value)}
              required
            />
          </label>
<label htmlFor="portal-businesssettings-4">
            <span>Teléfono</span>
            <input id="portal-businesssettings-4" name="telefono"
              inputMode="tel" autoComplete="section-business tel"
              value={negocio.telefono ?? ''}
              onChange={(event) => actualizar('telefono', event.target.value)}
            />
          </label>
<label htmlFor="portal-businesssettings-5">
            <span>Zona horaria</span>
            <input id="portal-businesssettings-5" name="zona_horaria"
              value={negocio.zona_horaria}
              onChange={(event) => actualizar('zona_horaria', event.target.value)}
              required
            />
          </label>
<label className="portal-form-wide" htmlFor="portal-businesssettings-6">
            <span>Dirección</span>
            <input id="portal-businesssettings-6" name="direccion"
              value={negocio.direccion}
              onChange={(event) => actualizar('direccion', event.target.value)}
            />
          </label>
        </PortalFormSection>
        <PortalFormSection title="Recursos de marca" description="Enlaces a las imágenes de tu negocio.">
<label htmlFor="portal-businesssettings-7">
            <span>URL del logo</span>
            <input id="portal-businesssettings-7" name="logo_url"
              value={negocio.logo_url ?? ''}
              onChange={(event) => actualizar('logo_url', event.target.value)}
            />
          </label>
<label htmlFor="portal-businesssettings-8">
            <span>URL del banner</span>
            <input id="portal-businesssettings-8" name="banner_url"
              value={negocio.banner_url ?? ''}
              onChange={(event) => actualizar('banner_url', event.target.value)}
            />
          </label>
        </PortalFormSection>
        <div className="portal-form-actions">
          <span className={negocio.status ? 'portal-badge is-on' : 'portal-badge'}>
            {negocio.status ? 'Negocio activo' : 'Negocio inactivo'}
          </span>
          <button
            className="portal-button-secondary"
            type="button"
            disabled={busy || !dirty}
            onClick={() => confirmClose(() => {
              if (original) setNegocio(original);
              setOk('Cambios descartados.');
            })}
          >
            Descartar cambios
          </button>
          <button className="portal-button" type="submit" disabled={busy}>
            {busy ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </PortalForm>

      {plan ? <PlanPanel plan={plan} /> : null}

      {mostrarQr ? (
        <BranchQRDialog
          kind="negocio"
          businessName={negocio.nombre}
          branch={{
            id: 0,
            nombre: 'Negocio completo',
            negocio: id,
            status: negocio.status,
            qr_uuid: negocio.qr_uuid,
          }}
          onClose={() => setMostrarQr(false)}
        />
      ) : null}
    </section>
  );
}
