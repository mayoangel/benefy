import { PortalPageHeader, PortalTable } from '../components/PortalUI';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useRequestGuard } from '../hooks/useRequestGuard';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { api } from '../../lib/api.ts';
import type { PaginaClientes } from '../../lib/types.ts';
import PortalPagination from '../components/PortalPagination.tsx';
import { PortalEmpty, PortalError, PortalLoading } from '../components/PortalState.tsx';

const vacio: PaginaClientes = { count: 0, page: 1, page_size: 20, results: [] };

export default function ClientsPage() {
  const { negocioId } = useParams();
  const id = Number(negocioId);
  const [searchParams, setSearchParams] = useSearchParams();
  const busquedaUrl = searchParams.get('buscar') ?? '';
  const [datos, setDatos] = useState(vacio);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buscar, setBuscar] = useState(busquedaUrl);
  const [page, setPage] = useState(1);

  const search = useDebouncedValue(buscar);

  useEffect(() => {
    setBuscar(busquedaUrl);
    setPage(1);
  }, [busquedaUrl]);

  function cambiarBusqueda(valor: string) {
    setBuscar(valor);
    setPage(1);
    const next = new URLSearchParams(searchParams);
    if (valor) next.set('buscar', valor);
    else next.delete('buscar');
    setSearchParams(next, { replace: true });
  }
  const requestGuard = useRequestGuard(Number(negocioId));
  const cargar = useCallback(async () => {
    const vigente = requestGuard();
    setLoading(true);
    setError(null);
    try {
      const respuesta = await api.getBusinessClients(id, {
        buscar: search, page, page_size: 20,
      });
      if (!vigente()) return;
      setDatos(respuesta);
    } catch (err) {
      if (!vigente()) return;
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los clientes.');
    } finally {
      if (vigente()) setLoading(false);
    }
  }, [requestGuard, search, id, page]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <section className="portal-page">
      <PortalPageHeader eyebrow="Actividad" title="Clientes del negocio" description={<>Datos operativos de clientes con visitas, puntos o cupones en este negocio.</>}>
        <button className="portal-button-secondary" type="button" onClick={() => void cargar()}>
          Actualizar
        </button>
      </PortalPageHeader>

      <div className="portal-panel portal-filters">
        <label className="portal-filter-wide" htmlFor="portal-clients-1">
          <span>Buscar por nombre o correo</span>
          <input id="portal-clients-1" name="portal-clients-1"
            value={buscar}
            onChange={(event) => cambiarBusqueda(event.target.value)}
            placeholder="Cliente o correo"
          />
        </label>
      </div>

      {loading && datos.results.length === 0 ? <PortalLoading /> : null}
      {loading && datos.results.length > 0 ? <p role="status" className="portal-muted">Actualizando resultados...</p> : null}
      {error ? <PortalError message={error} onRetry={() => void cargar()} /> : null}
      {!loading && !error && datos.results.length === 0 ? (
        <PortalEmpty message="No hay clientes con esos criterios." />
      ) : null}

      {datos.results.length > 0 ? (
        <div className="portal-panel">
          <PortalTable label="Listado de clientes" busy={loading}>
              <thead>
                <tr>
                  <th scope="col">Cliente</th><th scope="col">Correo</th><th className="portal-numeric" scope="col">Visitas</th>
                  <th className="portal-numeric" scope="col">Puntos</th><th className="portal-numeric" scope="col">Cupones</th><th scope="col">Última visita</th>
                </tr>
              </thead>
              <tbody>
                {datos.results.map((cliente) => (
                  <tr key={cliente.id}>
                    <td>{cliente.nombre} {cliente.apellido}</td>
                    <td>{cliente.correo}</td>
                    <td className="portal-numeric">
                      <Link
                        className="portal-table-link"
                        to={`/portal/negocio/${id}/visitas?cliente=${encodeURIComponent(cliente.correo)}`}
                      >
                        {cliente.visitas}
                      </Link>
                    </td>
                    <td className="portal-numeric">{cliente.puntos}</td>
                    <td className="portal-numeric">
                      <Link
                        className="portal-table-link"
                        to={`/portal/negocio/${id}/cupones?cliente=${encodeURIComponent(cliente.correo)}`}
                      >
                        {cliente.cupones}
                      </Link>
                    </td>
                    <td>
                      {cliente.ultima_visita
                        ? new Date(cliente.ultima_visita).toLocaleDateString('es-MX')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </PortalTable>
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
