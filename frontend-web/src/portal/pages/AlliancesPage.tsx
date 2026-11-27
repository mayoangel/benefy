import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth/AuthProvider.tsx';
import { api } from '../../lib/api.ts';
import { planLabel } from '../../lib/planLabels.ts';
import { membresiaDelNegocio } from '../../lib/portal.ts';
import type {
  AlianzaDetalle,
  AlianzaResumen,
  EstadoAlianza,
  NegocioAliado,
} from '../../lib/types.ts';
import AllianceDetail from '../components/AllianceDetail.tsx';
import AllianceWizard from '../components/AllianceWizard.tsx';
import { PortalPageHeader } from '../components/PortalUI';
import { PortalEmpty, PortalError, PortalLoading } from '../components/PortalState.tsx';
import { useDebouncedValue } from '../hooks/useDebouncedValue.ts';
import { usePlan } from '../hooks/usePlan.ts';
import { useRequestGuard } from '../hooks/useRequestGuard.ts';

type Tab = 'descubrir' | 'recibidas' | 'enviadas' | 'activas' | 'historial';

const TABS: { id: Tab; label: string }[] = [
  { id: 'descubrir', label: 'Descubrir' },
  { id: 'recibidas', label: 'Recibidas' },
  { id: 'enviadas', label: 'Enviadas' },
  { id: 'activas', label: 'Activas' },
  { id: 'historial', label: 'Historial' },
];

const ESTADOS: Record<EstadoAlianza, { texto: string; clase: string }> = {
  pendiente: { texto: 'Pendiente', clase: 'is-soon' },
  activa: { texto: 'Activa', clase: 'is-on' },
  finalizada: { texto: 'Finalizada', clase: '' },
  rechazada: { texto: 'Rechazada', clase: 'is-danger' },
};

function estadoAlianza(alianza: AlianzaResumen) {
  if (alianza.status === 'activa' && !alianza.vigente) {
    return new Date(alianza.fecha_inicio) > new Date()
      ? { texto: 'Programada', clase: 'is-soon' }
      : { texto: 'Vencida', clase: 'is-danger' };
  }
  return ESTADOS[alianza.status];
}

function fecha(value: string) {
  return new Date(value).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function inicial(nombre: string) {
  return nombre.trim().slice(0, 1).toUpperCase() || 'B';
}

function Logo({ negocio }: { negocio: NegocioAliado }) {
  if (negocio.logo_url) {
    return <img className="portal-alliance-logo" src={negocio.logo_url} alt="" loading="lazy" />;
  }
  return <span className="portal-alliance-logo is-fallback" aria-hidden="true">{inicial(negocio.nombre)}</span>;
}

function AlianzaCard({
  alianza,
  onOpen,
}: {
  alianza: AlianzaResumen;
  onOpen: () => void;
}) {
  const otro = alianza.direccion === 'recibida' ? alianza.negocio1 : alianza.negocio2;
  const estado = estadoAlianza(alianza);
  const accion = alianza.status === 'pendiente' && alianza.direccion === 'recibida'
    ? 'Revisar solicitud'
    : alianza.status === 'activa' ? 'Ver alianza' : 'Ver detalle';

  return (
    <article className="portal-alliance-card">
      <div className="portal-alliance-card-head">
        <Logo negocio={otro} />
        <div>
          <h2>{otro.nombre}</h2>
          <span className="portal-muted">{otro.categoria_nombre} · {otro.direccion}</span>
        </div>
        <span className={`portal-badge ${estado.clase}`}>{estado.texto}</span>
      </div>
      <p className="portal-alliance-condition">{alianza.condicion_participacion}</p>
      <dl className="portal-alliance-meta">
        <div><dt>Vigencia</dt><dd>{fecha(alianza.fecha_inicio)} — {fecha(alianza.fecha_fin)}</dd></div>
        <div><dt>Beneficios</dt><dd>{alianza.numero_beneficios}</dd></div>
      </dl>
      <div className="portal-alliance-card-actions">
        <button type="button" className="portal-button-secondary" onClick={onOpen}>
          {accion}
        </button>
      </div>
    </article>
  );
}

export default function AlliancesPage() {
  const { context } = useAuth();
  const { negocioId } = useParams();
  const id = Number(negocioId);
  const membresia = membresiaDelNegocio(context, id);
  const esDueno = membresia?.rol_comercio === 'dueno';
  const { plan, loading: planLoading } = usePlan(id);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: Tab = TABS.some((item) => item.id === tabParam)
    ? tabParam as Tab
    : 'descubrir';
  const [alianzas, setAlianzas] = useState<AlianzaResumen[]>([]);
  const [descubiertos, setDescubiertos] = useState<NegocioAliado[]>([]);
  const [buscar, setBuscar] = useState('');
  const search = useDebouncedValue(buscar);
  const [loading, setLoading] = useState(true);
  const [descubrirLoading, setDescubrirLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [descubrirError, setDescubrirError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [merchant, setMerchant] = useState<NegocioAliado | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const listGuard = useRequestGuard(id);
  const discoverGuard = useRequestGuard(id);

  const cargar = useCallback(async () => {
    const vigente = listGuard();
    setLoading(true);
    setError(null);
    try {
      const datos = await api.getAlliances(id);
      if (!vigente()) return;
      setAlianzas(datos);
    } catch (err) {
      if (!vigente()) return;
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las alianzas.');
    } finally {
      if (vigente()) setLoading(false);
    }
  }, [listGuard, id]);

  const cargarDescubiertos = useCallback(async () => {
    const vigente = discoverGuard();
    setDescubrirLoading(true);
    setDescubrirError(null);
    try {
      const datos = await api.discoverAlliances(id, { q: search });
      if (!vigente()) return;
      setDescubiertos(datos);
    } catch (err) {
      if (!vigente()) return;
      setDescubrirError(err instanceof Error ? err.message : 'No se pudieron cargar los comercios.');
    } finally {
      if (vigente()) setDescubrirLoading(false);
    }
  }, [discoverGuard, id, search]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (tab === 'descubrir') void cargarDescubiertos();
  }, [tab, cargarDescubiertos]);

  const recibidas = useMemo(
    () => alianzas.filter((item) => item.direccion === 'recibida' && item.status === 'pendiente'),
    [alianzas],
  );
  const enviadas = useMemo(
    () => alianzas.filter((item) => item.direccion === 'enviada' && item.status === 'pendiente'),
    [alianzas],
  );
  const activas = useMemo(
    () => alianzas.filter((item) => item.status === 'activa'),
    [alianzas],
  );
  const historial = useMemo(
    () => alianzas.filter((item) => item.status === 'rechazada' || item.status === 'finalizada'),
    [alianzas],
  );
  const listado = tab === 'recibidas' ? recibidas
    : tab === 'enviadas' ? enviadas
      : tab === 'activas' ? activas
        : historial;
  const puedeProponer = plan?.caracteristicas.alianzas_proponer === true;
  const limites = plan?.limites;
  const totalActivas = limites?.alianzas_activas;
  const conFree = limites?.alianzas_con_free;
  const conPremium = limites?.alianzas_con_premium;
  const limiteTexto = (limite: number | null | undefined) => limite === null || limite === undefined
    ? '∞' : limite;

  function cambiarTab(next: Tab) {
    const params = new URLSearchParams(searchParams);
    if (next === 'descubrir') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params);
  }

  function alCrear(alianza: AlianzaDetalle) {
    setMerchant(null);
    cambiarTab('enviadas');
    setOk(`Propuesta enviada a ${alianza.negocio2.nombre}.`);
    void cargar();
  }

  function alCambiar() {
    void cargar();
  }

  if (!esDueno) {
    return <PortalError message="Solo el propietario puede administrar las alianzas del negocio." />;
  }

  return (
    <section className="portal-page">
      <PortalPageHeader
        eyebrow="Alianzas"
        title="Alianzas comerciales"
        description={<>Conecta con otros negocios, acuerda beneficios y compártelos con tus clientes.</>}
      >
        <button type="button" className="portal-button-secondary" onClick={() => { cambiarTab('descubrir'); setBuscar(''); }}>
          Buscar comercios
        </button>
      </PortalPageHeader>

      {!planLoading && plan ? (
        <div className="portal-note portal-alliance-capacity">
          <strong>{planLabel(plan.plan)}:</strong>{' '}
          {puedeProponer
            ? 'puedes enviar y recibir solicitudes de alianza.'
            : 'puedes recibir, aceptar y rechazar solicitudes, pero no enviar nuevas.'}{' '}
          {totalActivas ? (
            <span>
              Alianzas activas: {totalActivas.uso} de {limiteTexto(totalActivas.limite)}.
            </span>
          ) : null}{' '}
          {plan.plan.codigo === 'premium' && conFree && conPremium ? (
            <span>
              Capacidad separada: {conFree.uso} de {limiteTexto(conFree.limite)} con el plan gratis y{' '}
              {conPremium.uso} de {limiteTexto(conPremium.limite)} con el plan premium.
            </span>
          ) : null}{' '}
          {!puedeProponer ? <Link to="/precios">Conocer el plan premium</Link> : null}
        </div>
      ) : null}
      {ok ? <p className="portal-note" role="status">{ok}</p> : null}
      {error ? <PortalError message={error} onRetry={() => void cargar()} /> : null}

      <div className="portal-panel portal-alliance-tabs-panel">
        <div className="portal-tabs" role="tablist" aria-label="Secciones de alianzas">
          {TABS.map((item) => {
            const conteo = item.id === 'recibidas' ? recibidas.length
              : item.id === 'enviadas' ? enviadas.length
                : item.id === 'activas' ? activas.length
                  : item.id === 'historial' ? historial.length : null;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`alliance-tab-${item.id}`}
                aria-selected={tab === item.id}
                aria-controls="alliance-panel"
                className={tab === item.id ? 'is-active' : ''}
                onClick={() => cambiarTab(item.id)}
              >
                {item.label}
                {conteo ? <span>{conteo}</span> : null}
              </button>
            );
          })}
        </div>

        <div id="alliance-panel" role="tabpanel" aria-labelledby={`alliance-tab-${tab}`}>
          {tab === 'descubrir' ? (
            <>
              <div className="portal-filters portal-alliance-search">
                <label className="portal-filter-wide" htmlFor="alliance-search">
                  <span>Buscar por nombre, categoría o dirección</span>
                  <input
                    id="alliance-search"
                    value={buscar}
                    onChange={(event) => setBuscar(event.target.value)}
                    placeholder="Ej. cafetería, Tijuana, Café Centro"
                  />
                </label>
              </div>
              {descubrirLoading && descubiertos.length === 0 ? <PortalLoading label="Buscando comercios..." /> : null}
              {descubrirError ? <PortalError message={descubrirError} onRetry={() => void cargarDescubiertos()} /> : null}
              {!descubrirLoading && !descubrirError && descubiertos.length === 0 ? (
                <PortalEmpty message="No hay comercios disponibles con esos criterios. Los comercios con una solicitud pendiente o una alianza activa no se muestran." />
              ) : null}
              {descubiertos.length > 0 ? (
                <div className="portal-alliance-grid">
                  {descubiertos.map((negocio) => (
                    <article className="portal-alliance-card" key={negocio.id}>
                      <div className="portal-alliance-card-head">
                        <Logo negocio={negocio} />
                        <div>
                          <h2>{negocio.nombre}</h2>
                          <span className="portal-muted">{negocio.categoria_nombre} · {negocio.direccion}</span>
                        </div>
                      </div>
                      <p className="portal-alliance-condition">
                        {negocio.descripcion || 'Este comercio aún no ha agregado una descripción.'}
                      </p>
                      <div className="portal-alliance-card-actions">
                        <button
                          type="button"
                          className="portal-button"
                          onClick={() => setMerchant(negocio)}
                          disabled={!puedeProponer}
                        >
                          Proponer alianza
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <>
              {loading && alianzas.length === 0 ? <PortalLoading /> : null}
              {loading && alianzas.length > 0 ? <p className="portal-muted" role="status">Actualizando alianzas...</p> : null}
              {!loading && !error && listado.length === 0 ? (
                <PortalEmpty message={
                  tab === 'recibidas' ? 'No tienes solicitudes recibidas pendientes.'
                    : tab === 'enviadas' ? 'No tienes solicitudes enviadas pendientes.'
                      : tab === 'activas' ? 'Aún no tienes alianzas activas.'
                        : 'No hay alianzas rechazadas o finalizadas.'
                } />
              ) : null}
              {listado.length > 0 ? (
                <div className="portal-alliance-grid">
                  {listado.map((alianza) => (
                    <AlianzaCard
                      key={alianza.id}
                      alianza={alianza}
                      onOpen={() => setDetailId(alianza.id)}
                    />
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {merchant && puedeProponer ? (
        <AllianceWizard
          businessId={id}
          merchant={merchant}
          onClose={() => setMerchant(null)}
          onCreated={alCrear}
        />
      ) : null}

      {detailId ? (
        <AllianceDetail
          businessId={id}
          allianceId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={alCambiar}
        />
      ) : null}
    </section>
  );
}
