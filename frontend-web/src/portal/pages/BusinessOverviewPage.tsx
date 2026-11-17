import { useRequestGuard } from '../hooks/useRequestGuard';
import { useCallback, useEffect, useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth/AuthProvider.tsx';
import { api } from '../../lib/api.ts';
import { membresiaDelNegocio } from '../../lib/portal.ts';
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
  const [plan, setPlan] = useState<PlanNegocio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const requestGuard = useRequestGuard(Number(negocioId));
  const cargar = useCallback(async () => {
    const vigente = requestGuard();
    if (!membresia) return;
    setLoading(true);
    setError(null);
    try {
      const [metricasData, planData] = await Promise.all([
        api.getMetrics(id, {
          sucursal: sucursalId,
          desde: desde || undefined,
          hasta: hasta || undefined,
        }),
        api.getBusinessPlan(id),
      ]);
      if (!vigente()) return;
      setMetricas(metricasData);
      setPlan(planData);
    } catch (err) {
      if (!vigente()) return;
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las métricas.');
    } finally {
      if (vigente()) setLoading(false);
    }
  }, [requestGuard, desde, hasta, id, membresia, sucursalId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (!membresia) {
    return <Navigate to="/portal" replace />;
  }

  const alcanceSucursal = metricas?.alcance === 'sucursal';

  return (
    <section className="portal-page">
      <header className="portal-page-head">
        <div>
          <span className="portal-eyebrow">Resumen</span>
          <h1>{membresia.negocio.nombre}</h1>
          <p>
            {alcanceSucursal
              ? 'Datos de la sucursal autorizada.'
              : 'Datos consolidados del negocio y todas sus sucursales.'}
          </p>
        </div>
        <button type="button" className="portal-button-secondary" onClick={() => void cargar()}>
          Actualizar
        </button>
      </header>

      <div className="portal-panel portal-filters">
        <label>
          <span>Desde</span>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label>
          <span>Hasta</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <span className="portal-muted">
          Sin fechas se muestran los últimos 30 días del negocio.
        </span>
      </div>

      {loading ? <PortalLoading /> : null}
      {error ? <PortalError message={error} onRetry={() => void cargar()} /> : null}

      {metricas && !loading ? (
        <>
          <div className="portal-kpi-grid">
            <article className="portal-kpi">
              <span>Visitas válidas</span>
              <strong>{valor(metricas.visitas_validas)}</strong>
              <small>{metricas.desde} a {metricas.hasta}</small>
            </article>
            <article className="portal-kpi">
              <span>Clientes únicos</span>
              <strong>{valor(metricas.clientes_unicos)}</strong>
              <small>Con al menos una visita</small>
            </article>
            <article className="portal-kpi">
              <span>Cupones canjeados</span>
              <strong>{valor(metricas.cupones_canjeados)}</strong>
              <small>{alcanceSucursal ? 'En la sucursal' : 'En el negocio'}</small>
            </article>
            {metricas.puntos_otorgados !== null ? (
              <>
                <article className="portal-kpi">
                  <span>Puntos otorgados</span>
                  <strong>{valor(metricas.puntos_otorgados)}</strong>
                  <small>En el periodo</small>
                </article>
                <article className="portal-kpi">
                  <span>Puntos consumidos</span>
                  <strong>{valor(metricas.puntos_consumidos)}</strong>
                  <small>En el periodo</small>
                </article>
                <article className="portal-kpi">
                  <span>Cupones emitidos</span>
                  <strong>{valor(metricas.cupones_emitidos)}</strong>
                  <small>En el periodo</small>
                </article>
                <article className="portal-kpi">
                  <span>Tarjetas completadas</span>
                  <strong>{valor(metricas.tarjetas_completadas)}</strong>
                  <small>En el periodo</small>
                </article>
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
                <div><dt>Rol</dt><dd>{membresia.rol_comercio}</dd></div>
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
