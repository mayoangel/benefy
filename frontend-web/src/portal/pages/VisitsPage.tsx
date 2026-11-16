import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { api } from '../../lib/api.ts';
import type { VisitaResumen } from '../../lib/types.ts';
import { PortalEmpty, PortalError, PortalLoading } from '../components/PortalState.tsx';

export default function VisitsPage() {
  const { negocioId } = useParams();
  const [searchParams] = useSearchParams();
  const negocio = Number(negocioId);
  const sucursal = searchParams.get('sucursal');
  const [visitas, setVisitas] = useState<VisitaResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getVisits();
      setVisitas(data.filter((visita) => visita.negocio === negocio));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las visitas.');
    } finally {
      setLoading(false);
    }
  }, [negocio]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const visibles = sucursal
    ? visitas.filter((visita) => String(visita.sucursal) === sucursal)
    : visitas;

  return (
    <section className="portal-page">
      <header className="portal-page-head">
        <div>
          <span className="portal-eyebrow">Operación</span>
          <h1>Visitas</h1>
          <p>Registros visibles según tu sucursal autorizada.</p>
        </div>
        <button type="button" className="portal-button-secondary" onClick={() => void cargar()}>
          Actualizar
        </button>
      </header>

      {loading ? <PortalLoading /> : null}
      {error ? <PortalError message={error} onRetry={() => void cargar()} /> : null}
      {!loading && !error && visibles.length === 0 ? (
        <PortalEmpty message="Aún no hay visitas registradas en este alcance." />
      ) : null}

      {!loading && !error && visibles.length > 0 ? (
        <div className="portal-panel">
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr><th>Fecha</th><th>Cliente</th><th>Sucursal</th><th>Método</th><th>Válida</th></tr>
              </thead>
              <tbody>
                {visibles.map((visita) => (
                  <tr key={visita.id}>
                    <td>{visita.fecha_negocio}</td>
                    <td>{visita.usuario_correo ?? `Usuario #${visita.usuario}`}</td>
                    <td>{visita.sucursal_nombre ?? 'QR del negocio'}</td>
                    <td>{visita.metodo_validacion}</td>
                    <td><span className={visita.es_valida ? 'portal-badge is-on' : 'portal-badge'}>{visita.es_valida ? 'Sí' : 'Anulada'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
