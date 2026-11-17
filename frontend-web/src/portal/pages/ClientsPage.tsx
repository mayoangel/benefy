import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { api } from '../../lib/api.ts';
import type { PaginaClientes } from '../../lib/types.ts';
import PortalPagination from '../components/PortalPagination.tsx';
import { PortalEmpty, PortalError, PortalLoading } from '../components/PortalState.tsx';

const vacio: PaginaClientes = { count: 0, page: 1, page_size: 20, results: [] };

export default function ClientsPage() {
  const { negocioId } = useParams();
  const id = Number(negocioId);
  const [datos, setDatos] = useState(vacio);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buscar, setBuscar] = useState('');
  const [page, setPage] = useState(1);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDatos(await api.getBusinessClients(id, {
        buscar, page, page_size: 20,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los clientes.');
    } finally {
      setLoading(false);
    }
  }, [buscar, id, page]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <section className="portal-page">
      <header className="portal-page-head">
        <div>
          <span className="portal-eyebrow">Clientes</span>
          <h1>Clientes del negocio</h1>
          <p>Datos operativos de clientes con visitas, puntos o cupones en este negocio.</p>
        </div>
        <button className="portal-button-secondary" type="button" onClick={() => void cargar()}>
          Actualizar
        </button>
      </header>

      <div className="portal-panel portal-filters">
        <label className="portal-filter-wide">
          <span>Buscar por nombre o correo</span>
          <input
            value={buscar}
            onChange={(event) => {
              setBuscar(event.target.value);
              setPage(1);
            }}
            placeholder="Cliente o correo"
          />
        </label>
      </div>

      {loading ? <PortalLoading /> : null}
      {error ? <PortalError message={error} onRetry={() => void cargar()} /> : null}
      {!loading && !error && datos.results.length === 0 ? (
        <PortalEmpty message="No hay clientes con esos criterios." />
      ) : null}

      {!loading && !error && datos.results.length > 0 ? (
        <div className="portal-panel">
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Cliente</th><th>Correo</th><th>Visitas</th>
                  <th>Puntos</th><th>Cupones</th><th>Última visita</th>
                </tr>
              </thead>
              <tbody>
                {datos.results.map((cliente) => (
                  <tr key={cliente.id}>
                    <td>{cliente.nombre} {cliente.apellido}</td>
                    <td>{cliente.correo}</td>
                    <td>{cliente.visitas}</td>
                    <td>{cliente.puntos}</td>
                    <td>{cliente.cupones}</td>
                    <td>
                      {cliente.ultima_visita
                        ? new Date(cliente.ultima_visita).toLocaleDateString('es-MX')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PortalPagination
            page={datos.page}
            pageSize={datos.page_size}
            count={datos.count}
            onPage={setPage}
          />
        </div>
      ) : null}
    </section>
  );
}
