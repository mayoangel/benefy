import { useRequestGuard } from '../hooks/useRequestGuard';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { api } from '../../lib/api.ts';
import type { CuponResumen, PaginaResultados } from '../../lib/types.ts';
import PortalPagination from '../components/PortalPagination.tsx';
import { PortalEmpty, PortalError, PortalLoading } from '../components/PortalState.tsx';

const vacio: PaginaResultados<CuponResumen> = {
  count: 0, next: null, previous: null, results: [],
};

export default function CouponsPage() {
  const { negocioId } = useParams();
  const id = Number(negocioId);
  const [datos, setDatos] = useState(vacio);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState({
    desde: '',
    hasta: '',
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
      const respuesta = await api.getBusinessCoupons(id, filtros);
      if (!vigente()) return;
      if (!vigente()) return;
      setDatos(respuesta);
    } catch (err) {
      if (!vigente()) return;
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los cupones.');
    } finally {
      if (vigente()) setLoading(false);
    }
  }, [requestGuard, filtros, id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function cambiar(campo: string, valor: string) {
    setFiltros((actual) => ({ ...actual, [campo]: valor, page: 1 }));
  }

  return (
    <section className="portal-page">
      <header className="portal-page-head">
        <div>
          <span className="portal-eyebrow">Lealtad</span>
          <h1>Cupones emitidos</h1>
          <p>Cupones adquiridos por clientes; los cupones ya emitidos no se invalidan al desactivar una recompensa.</p>
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
          <span>Estado</span>
          <select value={filtros.estado} onChange={(e) => cambiar('estado', e.target.value)}>
            <option value="">Todos</option>
            <option value="disponible">Disponible</option>
            <option value="canjeado">Canjeado</option>
            <option value="anulado">Anulado</option>
            <option value="vencido">Vencido</option>
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
        <PortalEmpty message="No hay cupones con esos filtros." />
      ) : null}

      {!loading && !error && datos.results.length > 0 ? (
        <div className="portal-panel">
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Beneficio</th><th>Cliente</th><th>Origen</th>
                  <th>Estado</th><th>Emitido</th><th>Expira</th>
                </tr>
              </thead>
              <tbody>
                {datos.results.map((cupon) => (
                  <tr key={cupon.id}>
                    <td>{cupon.titulo_beneficio || `Recompensa #${cupon.recompensa}`}</td>
                    <td>{cupon.usuario_correo ?? `Usuario #${cupon.usuario}`}</td>
                    <td>{cupon.origen}</td>
                    <td>
                      <span className={cupon.status === 'disponible' ? 'portal-badge is-on' : 'portal-badge'}>
                        {cupon.status}
                      </span>
                    </td>
                    <td>{cupon.fecha_emision ? new Date(cupon.fecha_emision).toLocaleDateString('es-MX') : '—'}</td>
                    <td>{new Date(cupon.fecha_expiracion).toLocaleDateString('es-MX')}</td>
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
