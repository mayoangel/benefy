import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth/AuthProvider.tsx';
import { api } from '../../lib/api.ts';
import { planLabel } from '../../lib/planLabels.ts';
import { membresiaDelNegocio, nombreRol } from '../../lib/portal.ts';
import type { AlianzaResumen, MetricasPortal, VisitaResumen } from '../../lib/types.ts';
import { PortalError, PortalLoading } from '../components/PortalState.tsx';
import PlanPanel from '../components/PlanPanel.tsx';
import { PortalIcon, PortalMetric, PortalPageHeader } from '../components/PortalUI.tsx';
import { usePlan } from '../hooks/usePlan.ts';
import { useRequestGuard } from '../hooks/useRequestGuard.ts';

function valor(valor: number | null) {
  return valor === null ? '—' : new Intl.NumberFormat('es-MX').format(valor);
}

type AccesoRapido = {
  label: string;
  description: string;
  href: string;
  icon: string;
};

export default function BusinessOverviewPage() {
  const { context } = useAuth();
  const { negocioId } = useParams();
  const [searchParams] = useSearchParams();
  const id = Number(negocioId);
  const membresia = membresiaDelNegocio(context, id);
  const sucursalParam = searchParams.get('sucursal');
  const sucursalId = sucursalParam ? Number(sucursalParam) : undefined;
  const [metricas, setMetricas] = useState<MetricasPortal | null>(null);
  const { plan, reload: reloadPlan } = usePlan(id);
  const allowed = Boolean(membresia);
  const esDueno = membresia?.rol_comercio === 'dueno';
  const esSupervisor = membresia?.rol_comercio === 'supervisor';
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [visitasRecientes, setVisitasRecientes] = useState<VisitaResumen[] | null>(null);
  const [solicitudesPendientes, setSolicitudesPendientes] = useState<number | null>(null);
  const [actividadLoading, setActividadLoading] = useState(true);
  const [actividadError, setActividadError] = useState<string | null>(null);

  const metricsGuard = useRequestGuard(Number(negocioId));
  const activityGuard = useRequestGuard(Number(negocioId));

  const cargar = useCallback(async () => {
    const vigente = metricsGuard();
    if (!allowed) return;
    setLoading(true);
    setError(null);
    try {
      const metricasData = await api.getMetrics(id, {
        sucursal: sucursalId, desde: desde || undefined, hasta: hasta || undefined,
      });
      if (!vigente()) return;
      setMetricas(metricasData);
    } catch (err) {
      if (!vigente()) return;
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las métricas.');
    } finally {
      if (vigente()) setLoading(false);
    }
  }, [metricsGuard, desde, hasta, id, allowed, sucursalId]);

  const cargarActividad = useCallback(async () => {
    const vigente = activityGuard();
    if (!allowed) return;
    setActividadLoading(true);
    setActividadError(null);
    const [visitas, alianzas] = await Promise.allSettled([
      api.getBusinessVisits(id, { page_size: 5, sucursal: sucursalId }),
      esDueno ? api.getAlliances(id) : Promise.resolve<AlianzaResumen[] | null>(null),
    ]);
    if (!vigente()) return;
    if (visitas.status === 'fulfilled') {
      setVisitasRecientes(visitas.value.results);
    } else {
      setVisitasRecientes(null);
      setActividadError('No se pudo cargar la actividad reciente.');
    }
    if (esDueno && alianzas.status === 'fulfilled' && alianzas.value) {
      const pendientes = alianzas.value.filter(
        (alianza) => alianza.direccion === 'recibida' && alianza.status === 'pendiente',
      ).length;
      setSolicitudesPendientes(pendientes);
    } else {
      setSolicitudesPendientes(null);
    }
    setActividadLoading(false);
  }, [activityGuard, id, allowed, esDueno, sucursalId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    void cargarActividad();
  }, [cargarActividad]);

  if (!membresia) {
    return <Navigate to="/portal" replace />;
  }

  const alcanceSucursal = metricas?.alcance === 'sucursal';

  function ruta(seccion: string, extra?: Record<string, string>) {
    const params = new URLSearchParams();
    if (sucursalParam) params.set('sucursal', sucursalParam);
    Object.entries(extra ?? {}).forEach(([clave, valor]) => {
      if (valor) params.set(clave, valor);
    });
    const search = params.toString();
    return `/portal/negocio/${id}/${seccion}${search ? `?${search}` : ''}`;
  }

  const accesos: AccesoRapido[] = [
    {
      label: 'Visitas',
      description: 'Consulta el historial y las validaciones recientes.',
      href: ruta('visitas'),
      icon: 'visitas',
    },
    {
      label: 'Canjes',
      description: 'Revisa cupones utilizados y operaciones del negocio.',
      href: ruta('canjes'),
      icon: 'canjes',
    },
  ];
  if (esDueno) {
    accesos.push(
      {
        label: 'Clientes',
        description: 'Identifica clientes con actividad, puntos o cupones.',
        href: ruta('clientes'),
        icon: 'clientes',
      },
      {
        label: 'Alianzas',
        description: solicitudesPendientes
          ? `${solicitudesPendientes} solicitud${solicitudesPendientes === 1 ? '' : 'es'} por revisar.`
          : 'Descubre comercios, revisa solicitudes y gestiona beneficios.',
        href: ruta('alianzas', solicitudesPendientes ? { tab: 'recibidas' } : undefined),
        icon: 'alianzas',
      },
      {
        label: 'Sucursales y QR',
        description: 'Administra sucursales y abre sus códigos QR.',
        href: ruta('sucursales'),
        icon: 'sucursales',
      },
      {
        label: 'Configuración y QR',
        description: 'Edita los datos del negocio y abre el QR general.',
        href: ruta('configuracion'),
        icon: 'configuracion',
      },
      {
        label: 'Plan y facturación',
        description: 'Consulta límites, consumo y administra la suscripción.',
        href: ruta('suscripcion'),
        icon: 'suscripcion',
      },
    );
  } else if (esSupervisor) {
    accesos.push({
      label: 'Equipo',
      description: 'Consulta el personal y sus accesos autorizados.',
      href: ruta('equipo'),
      icon: 'equipo',
    });
  }

  return (
    <section className="portal-page">
      <PortalPageHeader eyebrow="Inicio" title={membresia.negocio.nombre} description={alcanceSucursal
              ? 'Datos de la sucursal autorizada.'
              : 'Datos consolidados del negocio y todas sus sucursales.'}>
        <button type="button" className="portal-button-secondary" onClick={() => { void cargar(); void cargarActividad(); void reloadPlan(); }}>
          Actualizar
        </button>
      </PortalPageHeader>

      <section aria-labelledby="overview-quick-title">
        <div className="portal-section-heading">
          <h2 id="overview-quick-title">Accesos rápidos</h2>
        </div>
        <div className="portal-quick-grid">
          {accesos.map((acceso) => (
            <Link className={`portal-quick-card${acceso.label === 'Alianzas' && solicitudesPendientes ? ' is-pending' : ''}`} key={acceso.label} to={acceso.href}>
              <span className="portal-quick-icon"><PortalIcon name={acceso.icon} /></span>
              <strong>{acceso.label}</strong>
              <small>{acceso.description}</small>
              <span className="portal-quick-arrow">Abrir →</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="portal-panel portal-filters">
        <label htmlFor="portal-businessoverview-1">
          <span>Desde</span>
          <input id="portal-businessoverview-1" name="portal-businessoverview-1" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label htmlFor="portal-businessoverview-2">
          <span>Hasta</span>
          <input id="portal-businessoverview-2" name="portal-businessoverview-2" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <span className="portal-muted">
          Sin fechas se muestran los últimos 30 días del negocio.
        </span>
      </div>

      {loading && !metricas ? <PortalLoading /> : null}
      {loading && metricas ? <p role="status">Actualizando resumen...</p> : null}
      {error ? <PortalError message={error} onRetry={() => void cargar()} /> : null}

      {metricas ? (
        <>
          <div className="portal-kpi-grid">
            <PortalMetric label="Visitas válidas" value={valor(metricas.visitas_validas)} detail={<>{metricas.desde} a {metricas.hasta}</>} featured />
            <PortalMetric label="Clientes únicos" value={valor(metricas.clientes_unicos)} detail={<>Con al menos una visita</>} />
            <PortalMetric label="Cupones canjeados" value={valor(metricas.cupones_canjeados)} detail={alcanceSucursal ? 'En la sucursal' : 'En el negocio'} />
            {metricas.puntos_otorgados !== null ? (
              <>
                <PortalMetric label="Puntos otorgados" value={valor(metricas.puntos_otorgados)} detail={<>En el periodo</>} />
                <PortalMetric label="Puntos consumidos" value={valor(metricas.puntos_consumidos)} detail={<>En el periodo</>} />
                <PortalMetric label="Cupones emitidos" value={valor(metricas.cupones_emitidos)} detail={<>En el periodo</>} />
                <PortalMetric label="Tarjetas completadas" value={valor(metricas.tarjetas_completadas)} detail={<>En el periodo</>} />
              </>
            ) : null}
          </div>

          {alcanceSucursal ? (
            <p className="portal-note">
              Los puntos, cupones emitidos y tarjetas se contabilizan a nivel de negocio.
              Para verlos, selecciona “Todas las sucursales” en el selector.
            </p>
          ) : null}

          <div className="portal-overview-columns">
            <article className="portal-panel">
              <div className="portal-section-heading">
                <h2>Actividad reciente</h2>
                <Link className="portal-inline-link" to={ruta('visitas')}>Ver todo</Link>
              </div>
              {actividadLoading ? <p className="portal-muted">Cargando actividad…</p> : null}
              {actividadError ? <div className="portal-muted-box" role="status">{actividadError}</div> : null}
              {!actividadLoading && !actividadError && visitasRecientes?.length ? (
                <ul className="portal-activity-list">
                  {visitasRecientes.map((visita) => (
                    <li key={visita.id}>
                      <div className="portal-activity-main">
                        <strong>
                          {esDueno && visita.usuario_correo ? (
                            <Link
                              className="portal-table-link"
                              to={`/portal/negocio/${id}/clientes?buscar=${encodeURIComponent(visita.usuario_correo)}`}
                            >
                              {visita.usuario_correo}
                            </Link>
                          ) : (
                            visita.usuario_correo ?? `Usuario #${visita.usuario}`
                          )}
                        </strong>
                        <span>{visita.sucursal_nombre ?? 'QR del negocio'}</span>
                      </div>
                      <div className="portal-activity-meta">
                        <time dateTime={visita.fecha_negocio}>{visita.fecha_negocio}</time>
                        <span className={visita.es_valida ? 'portal-badge is-on' : 'portal-badge'}>
                          {visita.es_valida ? 'Válida' : 'Anulada'}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
              {!actividadLoading && !actividadError && !visitasRecientes?.length ? (
                <p className="portal-muted">Aún no hay visitas registradas en este alcance.</p>
              ) : null}
            </article>

            {esDueno && solicitudesPendientes ? (
              <article className="portal-panel portal-pending-summary">
                <div>
                  <strong>
                    {solicitudesPendientes === 1
                      ? 'Tienes una solicitud de alianza pendiente'
                      : `Tienes ${solicitudesPendientes} solicitudes de alianza pendientes`}
                  </strong>
                  <p>Revísalas antes de que pierdas la oportunidad de conectar con otro negocio.</p>
                  <Link className="portal-inline-link" to={ruta('alianzas', { tab: 'recibidas' })}>
                    Revisar solicitudes
                  </Link>
                </div>
                <span className="portal-pending-count">{solicitudesPendientes}</span>
              </article>
            ) : null}
          </div>

          <div className="portal-section-grid">
            <article className="portal-panel">
              <h2>Información del negocio</h2>
              <dl className="portal-details">
                <div><dt>Rol</dt><dd>{nombreRol(membresia.rol_comercio)}</dd></div>
                <div><dt>Plan</dt><dd>{plan ? planLabel(plan.plan) : '—'}</dd></div>
                <div><dt>Zona horaria</dt><dd>{membresia.negocio.zona_horaria}</dd></div>
                <div><dt>Estado</dt><dd>{membresia.negocio.status ? 'Activo' : 'Inactivo'}</dd></div>
                <div><dt>Sucursales disponibles</dt><dd>{context?.sucursales.filter((s) => s.negocio === id).length ?? 0}</dd></div>
              </dl>
            </article>
            <article className="portal-panel">
              <h2>Top recompensas</h2>
              {metricas.top_recompensas.length > 0 ? (
                <ul className="portal-list">
                  {metricas.top_recompensas.map((item) => (
                    <li key={item.titulo}>
                      <span>{item.titulo}</span>
                      <strong>{item.total}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="portal-muted">Aún no hay cupones emitidos en el periodo.</p>
              )}
            </article>
          </div>

          {plan ? <PlanPanel plan={plan} /> : null}
        </>
      ) : null}
    </section>
  );
}
