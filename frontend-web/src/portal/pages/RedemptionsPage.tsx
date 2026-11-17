import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useRequestGuard } from '../hooks/useRequestGuard';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth/AuthProvider.tsx';
import { api } from '../../lib/api.ts';
import type { CanjeResumen, PaginaResultados } from '../../lib/types.ts';
import PortalPagination from '../components/PortalPagination.tsx';
import { PortalEmpty, PortalError, PortalLoading } from '../components/PortalState.tsx';

const vacio: PaginaResultados<CanjeResumen> = {
  count: 0, next: null, previous: null, results: [],
};

export default function RedemptionsPage() {
  const { context } = useAuth();
  const { negocioId } = useParams();
  const id = Number(negocioId);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedBranch = searchParams.get('sucursal') ?? '';
  const [datos, setDatos] = useState(vacio);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState({
    desde: '',
    hasta: '',
    sucursal: '',
    anulado: '',
    buscar: '',
    page: 1,
    page_size: 20,
  });

  const search = useDebouncedValue(filtros.buscar);
  const query = useMemo(() => ({...filtros, buscar: search}), [search, filtros.desde, filtros.hasta, filtros.page, filtros.page_size, filtros.anulado, filtros.sucursal]);
  const requestGuard = useRequestGuard(Number(negocioId));
  const cargar = useCallback(async () => {
    const vigente = requestGuard();
    setLoading(true);
    setError(null);
    try {
      const respuesta = await api.getBusinessRedemptions(id, {...query, sucursal: selectedBranch});
      if (!vigente()) return;
      setDatos(respuesta);
    } catch (err) {
      if (!vigente()) return;
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los canjes.');
    } finally {
      if (vigente()) setLoading(false);
    }
  }, [requestGuard, query, id, selectedBranch]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const sucursales = context?.sucursales.filter(
    (sucursal) => sucursal.negocio === id,
  ) ?? [];

  function cambiar(campo: string, valor: string) {
    if (campo === 'sucursal') {
      const next = new URLSearchParams(searchParams);
      if (valor) next.set('sucursal', valor); else next.delete('sucursal');
      setSearchParams(next);
    }
    setFiltros((actual) => ({ ...actual, [campo]: valor, page: 1 }));
  }

  return (
    <section className="portal-page">
      <header className="portal-page-head">
        <div>
          <span className="portal-eyebrow">Operación</span>
          <h1>Canjes</h1>
          <p>Cupones utilizados en el negocio o en tu sucursal.</p>
        </div>
        <button className="portal-button-secondary" type="button" onClick={() => void cargar()}>
          Actualizar
        </button>
      </header>

      <div className="portal-panel portal-filters">
        <label>
          <span>Desde</span>
          <input type="date" value={filtros.desde} onChange={(e) => cambiar('desde', e.target.value)} />
        </label>
        <label>
          <span>Hasta</span>
          <input type="date" value={filtros.hasta} onChange={(e) => cambiar('hasta', e.target.value)} />
        </label>
        <label>
          <span>Sucursal</span>
          <select value={selectedBranch} onChange={(e) => cambiar('sucursal', e.target.value)}>
            <option value="">Todas</option>
            {sucursales.map((sucursal) => (
              <option key={sucursal.id} value={sucursal.id}>{sucursal.nombre}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Estado</span>
          <select value={filtros.anulado} onChange={(e) => cambiar('anulado', e.target.value)}>
            <option value="">Todos</option>
            <option value="false">Vigentes</option>
            <option value="true">Anulados</option>
          </select>
        </label>
        <label>
          <span>Cliente</span>
          <input
            placeholder="correo@ejemplo.com"
            value={filtros.buscar}
            onChange={(e) => cambiar('buscar', e.target.value)}
          />
        </label>
      </div>

      {loading && datos.results.length === 0 ? <PortalLoading /> : null}
      {loading && datos.results.length > 0 ? <p role="status" className="portal-muted">Actualizando resultados...</p> : null}
      {error ? <PortalError message={error} onRetry={() => void cargar()} /> : null}
      {!loading && !error && datos.results.length === 0 ? (
        <PortalEmpty message="No hay canjes con esos filtros." />
      ) : null}

      {datos.results.length > 0 ? (
        <div className="portal-panel">
          <div tabIndex={0} role="region" aria-label="Listado de canjes" className="portal-table-wrap" aria-busy={loading}>
            <table className="portal-table">
              <thead>
                <tr>
                  <th scope="col">Fecha</th><th scope="col">Beneficio</th><th scope="col">Cliente</th>
                  <th scope="col">Sucursal</th><th scope="col">Método</th><th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {datos.results.map((canje) => (
                  <tr key={canje.id}>
                    <td>{new Date(canje.fecha).toLocaleDateString('es-MX')}</td>
                    <td>{canje.titulo_beneficio || `Cupón #${canje.cupon}`}</td>
                    <td>{canje.usuario_correo ?? '—'}</td>
                    <td>{canje.sucursal_nombre ?? 'Todo el negocio'}</td>
                    <td>{canje.metodo}</td>
                    <td>
                      <span className={canje.anulado ? 'portal-badge' : 'portal-badge is-on'}>
                        {canje.anulado ? 'Anulado' : 'Vigente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PortalPagination
            page={filtros.page}
            pageSize={filtros.page_size}
            count={datos.count}
            onPage={(page) => setFiltros((actual) => ({ ...actual, page }))}
          />
        </div>
      ) : null}
    </section>
  );
}
