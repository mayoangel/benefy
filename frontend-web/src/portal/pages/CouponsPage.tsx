import { PortalPageHeader, PortalTable } from '../components/PortalUI';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useRequestGuard } from '../hooks/useRequestGuard';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const clienteUrl = searchParams.get('cliente') ?? '';
  const [datos, setDatos] = useState(vacio);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState({
    desde: '',
    hasta: '',
    estado: '',
    buscar: clienteUrl,
    page: 1,
    page_size: 20,
  });

  const search = useDebouncedValue(filtros.buscar);
  const query = useMemo(() => ({...filtros, buscar: search}), [search, filtros.desde, filtros.hasta, filtros.page, filtros.page_size, filtros.estado]);
  const requestGuard = useRequestGuard(Number(negocioId));
  const cargar = useCallback(async () => {
    const vigente = requestGuard();
    setLoading(true);
    setError(null);
    try {
      const respuesta = await api.getBusinessCoupons(id, query);
      if (!vigente()) return;
      setDatos(respuesta);
    } catch (err) {
      if (!vigente()) return;
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los cupones.');
    } finally {
      if (vigente()) setLoading(false);
    }
  }, [requestGuard, query, id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    setFiltros((actual) => (
      actual.buscar === clienteUrl
        ? actual
        : { ...actual, buscar: clienteUrl, page: 1 }
    ));
  }, [clienteUrl]);

  function cambiar(campo: string, valor: string) {
    if (campo === 'buscar') {
      const next = new URLSearchParams(searchParams);
      if (valor) next.set('cliente', valor); else next.delete('cliente');
      setSearchParams(next, { replace: true });
    }
    setFiltros((actual) => ({ ...actual, [campo]: valor, page: 1 }));
  }

  return (
    <section className="portal-page">
      <PortalPageHeader eyebrow="Actividad" title="Cupones emitidos" description={<>Cupones adquiridos por clientes; los cupones ya emitidos no se invalidan al desactivar una recompensa.</>}>
        <Link className="portal-button-secondary" to={`/portal/negocio/${id}/canjes`}>
          Ver canjes
        </Link>
        <button className="portal-button-secondary" type="button" onClick={() => void cargar()}>
          Actualizar
        </button>
      </PortalPageHeader>

      <div className="portal-panel portal-filters">
        <label htmlFor="portal-coupons-1">
          <span>Desde</span>
          <input id="portal-coupons-1" name="desde" type="date" value={filtros.desde} onChange={(e) => cambiar('desde', e.target.value)} />
        </label>
        <label htmlFor="portal-coupons-2">
          <span>Hasta</span>
          <input id="portal-coupons-2" name="hasta" type="date" value={filtros.hasta} onChange={(e) => cambiar('hasta', e.target.value)} />
        </label>
        <label htmlFor="portal-coupons-3">
          <span>Estado</span>
          <select id="portal-coupons-3" name="estado" value={filtros.estado} onChange={(e) => cambiar('estado', e.target.value)}>
            <option value="">Todos</option>
            <option value="disponible">Disponible</option>
            <option value="canjeado">Canjeado</option>
            <option value="anulado">Anulado</option>
            <option value="vencido">Vencido</option>
          </select>
        </label>
        <label htmlFor="portal-coupons-4">
          <span>Cliente</span>
          <input id="portal-coupons-4" name="buscar"
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
        <PortalEmpty message="No hay cupones con esos filtros." />
      ) : null}

      {datos.results.length > 0 ? (
        <div className="portal-panel">
          <PortalTable label="Listado de cupones" busy={loading}>
              <thead>
                <tr>
                  <th scope="col">Beneficio</th><th scope="col">Cliente</th><th scope="col">Origen</th>
                  <th scope="col">Estado</th><th scope="col">Emitido</th><th scope="col">Expira</th>
                </tr>
              </thead>
              <tbody>
                {datos.results.map((cupon) => (
                  <tr key={cupon.id}>
                    <td>{cupon.titulo_beneficio || `Recompensa #${cupon.recompensa}`}</td>
                    <td>
                      {cupon.usuario_correo ? (
                        <Link
                          className="portal-table-link"
                          to={`/portal/negocio/${id}/clientes?buscar=${encodeURIComponent(cupon.usuario_correo)}`}
                        >
                          {cupon.usuario_correo}
                        </Link>
                      ) : (
                        `Usuario #${cupon.usuario}`
                      )}
                    </td>
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
            </PortalTable>
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
