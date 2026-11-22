import { PortalPageHeader, PortalMetric } from '../components/PortalUI';
import { usePlan } from '../hooks/usePlan';
import { useRequestGuard } from '../hooks/useRequestGuard';
import { useCallback, useEffect, useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth/AuthProvider.tsx';
import { api } from '../../lib/api.ts';
import { membresiaDelNegocio, nombreRol } from '../../lib/portal.ts';
import type { MetricasPortal, PlanNegocio } from '../../lib/types.ts';
import { PortalError, PortalLoading } from '../components/PortalState.tsx';
import PlanPanel from '../components/PlanPanel.tsx';

function valor(valor: number | null) {
  return valor === null ? '—' : new Intl.NumberFormat('es-MX').format(valor);
}

export default function BusinessOverviewPage() {
  const { context } = useAuth();
  const { negocioId } = useParams();
  const [searchParams] = useSearchParams();
  const id = Number(negocioId);
  const membresia = membresiaDelNegocio(context, id);
  const sucursalParam = searchParams.get('sucursal');
  const sucursalId = sucursalParam ? Number(sucursalParam) : undefined;
  const [metricas, setMetricas] = useState<MetricasPortal | null>(null);
  const {plan, reload: reloadPlan} = usePlan(id);
  const allowed = Boolean(membresia);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const requestGuard = useRequestGuard(Number(negocioId));
  const cargar = useCallback(async () => {
    const vigente = requestGuard();
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
  }, [requestGuard, desde, hasta, id, allowed, sucursalId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (!membresia) {
    return <Navigate to="/portal" replace />;
  }

  const alcanceSucursal = metricas?.alcance === 'sucursal';

  return (
    <section className="portal-page">
      <PortalPageHeader eyebrow="Resumen" title={membresia.negocio.nombre} description={alcanceSucursal
              ? 'Datos de la sucursal autorizada.'
              : 'Datos consolidados del negocio y todas sus sucursales.'}>
        <button type="button" className="portal-button-secondary" onClick={() => { void cargar(); void reloadPlan(); }}>
          Actualizar
        </button>
      </PortalPageHeader>

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

          <div className="portal-section-grid">
            <article className="portal-panel">
              <h2>Información del negocio</h2>
              <dl className="portal-details">
                <div><dt>Rol</dt><dd>{nombreRol(membresia.rol_comercio)}</dd></div>
                <div><dt>Plan</dt><dd>{plan?.plan.nombre ?? '—'}</dd></div>
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
