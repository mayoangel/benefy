import { useRequestGuard } from '../hooks/useRequestGuard';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth/AuthProvider.tsx';
import { api } from '../../lib/api.ts';
import type { PaginaResultados, VisitaResumen } from '../../lib/types.ts';
import PortalPagination from '../components/PortalPagination.tsx';
import { PortalEmpty, PortalError, PortalLoading } from '../components/PortalState.tsx';

const vacio: PaginaResultados<VisitaResumen> = {
  count: 0, next: null, previous: null, results: [],
};

export default function VisitsPage() {
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
    estado: '',
    buscar: '',
    page: 1,
    page_size: 20,
  });

  const requestGuard = useRequestGuard(Number(negocioId));
  const cargar = useCallback(async () => {
    const vigente = requestGuard();
    setLoading(true);
    setError(null);
    try {
      const respuesta = await api.getBusinessVisits(id, {...filtros, sucursal: selectedBranch});
      if (!vigente()) return;
      if (!vigente()) return;
      setDatos(respuesta);
    } catch (err) {
      if (!vigente()) return;
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las visitas.');
    } finally {
      if (vigente()) setLoading(false);
    }
  }, [requestGuard, filtros, id, selectedBranch]);

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
          <span className="portal-eyebrow">OperaciÃ³n</span>
          <h1>Visitas</h1>
          <p>Historial de visitas vÃ¡lidas y anuladas dentro de tu alcance.</p>
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
          <select value={filtros.estado} onChange={(e) => cambiar('estado', e.target.value)}>
            <option value="">Todas</option>
            <option value="validas">VÃ¡lidas</option>
            <option value="anuladas">Anuladas</option>
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

      {loading ? <PortalLoading /> : null}
      {error ? <PortalError message={error} onRetry={() => void cargar()} /> : null}
      {!loading && !error && datos.results.length === 0 ? (
        <PortalEmpty message="No hay visitas con esos filtros." />
      ) : null}

      {!loading && !error && datos.results.length > 0 ? (
        <div className="portal-panel">
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Fecha</th><th>Cliente</th><th>Sucursal</th>
                  <th>MÃ©todo</th><th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {datos.results.map((visita) => (
                  <tr key={visita.id}>
                    <td>{visita.fecha_negocio}</td>
                    <td>{visita.usuario_correo ?? `Usuario #${visita.usuario}`}</td>
                    <td>{visita.sucursal_nombre ?? 'QR del negocio'}</td>
                    <td>{visita.metodo_validacion}</td>
                    <td>
                      <span className={visita.es_valida ? 'portal-badge is-on' : 'portal-badge'}>
                        {visita.es_valida ? 'VÃ¡lida' : 'Anulada'}
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
