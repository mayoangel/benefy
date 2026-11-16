import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { useAuth } from '../../auth/AuthProvider.tsx';
import { api } from '../../lib/api.ts';
import type { MembresiaResumen } from '../../lib/types.ts';
import { PortalEmpty, PortalError, PortalLoading } from '../components/PortalState.tsx';

export default function TeamPage() {
  const { context, profile } = useAuth();
  const { negocioId } = useParams();
  const id = Number(negocioId);
  const [filas, setFilas] = useState<MembresiaResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMemberships();
      setFilas(data.filter((fila) => fila.negocio === id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el equipo.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const rolActual = context?.membresias.find((m) => m.negocio.id === id)?.rol_comercio;
  if (rolActual === 'empleado') {
    return <PortalError message="No tienes permisos para consultar el equipo." />;
  }

  return (
    <section className="portal-page">
      <header className="portal-page-head">
        <div>
          <span className="portal-eyebrow">Equipo</span>
          <h1>Membresías del negocio</h1>
          <p>Personas con acceso al negocio o a tu sucursal.</p>
        </div>
      </header>

      {loading ? <PortalLoading /> : null}
      {error ? <PortalError message={error} onRetry={() => void cargar()} /> : null}
      {!loading && !error && filas.length === 0 ? (
        <PortalEmpty message="No hay otras membresías visibles." />
      ) : null}

      {!loading && !error && filas.length > 0 ? (
        <div className="portal-panel">
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr><th>Usuario</th><th>Correo</th><th>Rol</th><th>Sucursal</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {filas.map((fila) => (
                  <tr key={fila.id} className={fila.usuario === profile?.id ? 'is-current' : ''}>
                    <td>{fila.usuario_nombre ?? `Usuario #${fila.usuario}`}</td>
                    <td>{fila.usuario_correo ?? '—'}</td>
                    <td>{fila.rol_comercio}</td>
                    <td>{fila.sucursal_nombre ?? 'Todo el negocio'}</td>
                    <td><span className={fila.status ? 'portal-badge is-on' : 'portal-badge'}>{fila.status ? 'Activa' : 'Inactiva'}</span></td>
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
