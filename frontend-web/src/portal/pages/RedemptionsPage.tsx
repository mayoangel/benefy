import { PortalPageHeader, PortalTable } from '../components/PortalUI';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useRequestGuard } from '../hooks/useRequestGuard';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth/AuthProvider.tsx';
import { api } from '../../lib/api.ts';
import { membresiaDelNegocio } from '../../lib/portal.ts';
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
  const membresia = membresiaDelNegocio(context, id);
  const esDueno = membresia?.rol_comercio === 'dueno';
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedBranch = searchParams.get('sucursal') ?? '';
  const clienteUrl = searchParams.get('cliente') ?? '';
  const [datos, setDatos] = useState(vacio);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState({
    desde: '',
    hasta: '',
    sucursal: '',
    anulado: '',
    buscar: clienteUrl,
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

  useEffect(() => {
    setFiltros((actual) => (
      actual.buscar === clienteUrl
        ? actual
        : { ...actual, buscar: clienteUrl, page: 1 }
    ));
  }, [clienteUrl]);

  const sucursales = context?.sucursales.filter(
    (sucursal) => sucursal.negocio === id,
  ) ?? [];

  function cambiar(campo: string, valor: string) {
    if (campo === 'sucursal' || campo === 'buscar') {
      const next = new URLSearchParams(searchParams);
      if (campo === 'sucursal') {
        if (valor) next.set('sucursal', valor); else next.delete('sucursal');
      } else {
        if (valor) next.set('cliente', valor); else next.delete('cliente');
      }
      setSearchParams(next, { replace: campo === 'buscar' });
    }
    setFiltros((actual) => ({ ...actual, [campo]: valor, page: 1 }));
  }

  return (
    <section className="portal-page">
      <PortalPageHeader eyebrow="Actividad" title="Canjes" description={<>Cupones utilizados en el negocio o en tu sucursal.</>}>
        <Link
          className="portal-button-secondary"
          to={`/portal/negocio/${id}/visitas${selectedBranch ? `?sucursal=${encodeURIComponent(selectedBranch)}` : ''}`}
        >
          Ver visitas
        </Link>
        {esDueno ? (
          <Link className="portal-button-secondary" to={`/portal/negocio/${id}/cupones`}>
            Ver cupones
          </Link>
        ) : null}
        <button className="portal-button-secondary" type="button" onClick={() => void cargar()}>
          Actualizar
        </button>
      </PortalPageHeader>

      <div className="portal-panel portal-filters">
        <label htmlFor="portal-redemptions-1">
          <span>Desde</span>
          <input id="portal-redemptions-1" name="desde" type="date" value={filtros.desde} onChange={(e) => cambiar('desde', e.target.value)} />
        </label>
        <label htmlFor="portal-redemptions-2">
          <span>Hasta</span>
          <input id="portal-redemptions-2" name="hasta" type="date" value={filtros.hasta} onChange={(e) => cambiar('hasta', e.target.value)} />
        </label>
        <label htmlFor="portal-redemptions-3">
          <span>Sucursal</span>
          <select id="portal-redemptions-3" name="portal-redemptions-3" value={selectedBranch} onChange={(e) => cambiar('sucursal', e.target.value)}>
            <option value="">Todas</option>
            {sucursales.map((sucursal) => (
              <option key={sucursal.id} value={sucursal.id}>{sucursal.nombre}</option>
            ))}
          </select>
        </label>
        <label htmlFor="portal-redemptions-4">
          <span>Estado</span>
          <select id="portal-redemptions-4" name="anulado" value={filtros.anulado} onChange={(e) => cambiar('anulado', e.target.value)}>
            <option value="">Todos</option>
            <option value="false">Vigentes</option>
            <option value="true">Anulados</option>
          </select>
        </label>
        <label htmlFor="portal-redemptions-5">
          <span>Cliente</span>
          <input id="portal-redemptions-5" name="buscar"
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
          <PortalTable label="Listado de canjes" busy={loading}>
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
                    <td>
                      {esDueno && canje.usuario_correo ? (
                        <Link
                          className="portal-table-link"
                          to={`/portal/negocio/${id}/clientes?buscar=${encodeURIComponent(canje.usuario_correo)}`}
                        >
                          {canje.usuario_correo}
                        </Link>
                      ) : (
                        canje.usuario_correo ?? '—'
                      )}
                    </td>
                    <td>{canje.sucursal_nombre ?? 'Todo el negocio'}</td>
                    <td>{canje.metodo === 'qr' ? 'QR' : canje.metodo === 'nfc' ? 'NFC' : canje.metodo}</td>
                    <td>
                      <span className={canje.anulado ? 'portal-badge' : 'portal-badge is-on'}>
                        {canje.anulado ? 'Anulado' : 'Vigente'}
                      </span>
                    </td>
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
