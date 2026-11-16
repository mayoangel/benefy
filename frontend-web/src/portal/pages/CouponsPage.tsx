import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { api } from '../../lib/api.ts';
import type { CuponResumen } from '../../lib/types.ts';
import { PortalEmpty, PortalError, PortalLoading } from '../components/PortalState.tsx';

export default function CouponsPage() {
  const { negocioId } = useParams();
  const id = Number(negocioId);
  const [cupones, setCupones] = useState<CuponResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCoupons();
      setCupones(data.filter((cupon) => cupon.negocio === id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los cupones.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <section className="portal-page">
      <header className="portal-page-head">
        <div>
          <span className="portal-eyebrow">Lealtad</span>
          <h1>Cupones</h1>
          <p>Cupones emitidos a clientes del negocio.</p>
        </div>
      </header>

      {loading ? <PortalLoading /> : null}
      {error ? <PortalError message={error} onRetry={() => void cargar()} /> : null}
      {!loading && !error && cupones.length === 0 ? (
        <PortalEmpty message="No hay cupones emitidos en el alcance actual." />
      ) : null}

      {!loading && !error && cupones.length > 0 ? (
        <div className="portal-panel">
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr><th>Beneficio</th><th>Cliente</th><th>Origen</th><th>Estado</th><th>Expira</th></tr>
              </thead>
              <tbody>
                {cupones.map((cupon) => (
                  <tr key={cupon.id}>
                    <td>{cupon.titulo_beneficio || `Recompensa #${cupon.recompensa}`}</td>
                    <td>{cupon.usuario_correo ?? `Usuario #${cupon.usuario}`}</td>
                    <td>{cupon.origen}</td>
                    <td><span className={cupon.status === 'disponible' ? 'portal-badge is-on' : 'portal-badge'}>{cupon.status}</span></td>
                    <td>{new Date(cupon.fecha_expiracion).toLocaleDateString('es-MX')}</td>
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
