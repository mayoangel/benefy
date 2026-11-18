import { PortalPageHeader, PortalTable, PortalRoleBadge } from '../components/PortalUI';
import { useRequestGuard } from '../hooks/useRequestGuard';
import { useCallback, useEffect, useState } from 'react';

import { api } from '../../lib/api.ts';
import type { NegocioResumen, UsuarioResumen } from '../../lib/types.ts';
import { PortalError, PortalLoading } from '../components/PortalState.tsx';

export default function AdminOverviewPage() {
  const [negocios, setNegocios] = useState<NegocioResumen[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioResumen[]>([]);
  const [planes, setPlanes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestGuard = useRequestGuard(0);
  const cargar = useCallback(async () => {
    const vigente = requestGuard();
    setLoading(true);
    setError(null);
    try {
      const [negociosData, usuariosData] = await Promise.all([
        api.getBusinesses(),
        api.getUsers(),
      ]);
      if (!vigente()) return;
      setNegocios(negociosData);
      setUsuarios(usuariosData);
      const planesData = await Promise.all(negociosData.map(async (negocio) => {
        try {
          const detalle = await api.getBusinessPlan(negocio.id);
          return [negocio.id, detalle.plan.nombre] as const;
        } catch {
          return [negocio.id, '—'] as const;
        }
      }));
      setPlanes(Object.fromEntries(planesData));
    } catch (err) {
      if (!vigente()) return;
      setError(err instanceof Error ? err.message : 'No se pudo cargar la administración global.');
    } finally {
      if (vigente()) setLoading(false);
    }
  }, [requestGuard, ]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <section className="portal-page">
      <PortalPageHeader eyebrow="Benefy" title="Administración global" description={<>Resumen de negocios y usuarios de la plataforma.</>}>
        <button type="button" className="portal-button-secondary" onClick={() => void cargar()}>
          Actualizar
        </button>
      </PortalPageHeader>

      {loading ? <PortalLoading /> : null}
      {error ? <PortalError message={error} onRetry={() => void cargar()} /> : null}

      {!loading && !error ? (
        <>
          <div className="portal-kpi-grid portal-admin-kpis">
            <article className="portal-kpi">
              <span>Negocios</span>
              <strong>{negocios.length}</strong>
              <small>{negocios.filter((n) => n.status).length} activos</small>
            </article>
            <article className="portal-kpi">
              <span>Usuarios</span>
              <strong>{usuarios.length}</strong>
              <small>{usuarios.filter((u) => u.rol === 'admin_sistema').length} administradores</small>
            </article>
          </div>

          <div className="portal-section-grid">
            <article className="portal-panel">
              <h2>Negocios</h2>
              <PortalTable label="Listado de negocios">
                  <thead><tr><th scope="col">ID</th><th scope="col">Negocio</th><th scope="col">Plan</th><th scope="col">Estado</th></tr></thead>
                  <tbody>
                    {negocios.map((negocio) => (
                      <tr key={negocio.id}>
                        <td>{negocio.id}</td>
                        <td>{negocio.nombre}</td>
                        <td>{planes[negocio.id] ?? '—'}</td>
                        <td><span className={negocio.status ? 'portal-badge is-on' : 'portal-badge'}>{negocio.status ? 'Activo' : 'Inactivo'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </PortalTable>
            </article>

            <article className="portal-panel">
              <h2>Usuarios</h2>
              <PortalTable label="Listado de usuarios">
                  <thead><tr><th scope="col">Usuario</th><th scope="col">Correo</th><th scope="col">Rol</th></tr></thead>
                  <tbody>
                    {usuarios.map((usuario) => (
                      <tr key={usuario.id}>
                        <td>{usuario.nombre} {usuario.apellido}</td>
                        <td>{usuario.correo}</td>
                        <td><PortalRoleBadge role={usuario.rol} /></td>
                      </tr>
                    ))}
                  </tbody>
                </PortalTable>
            </article>
          </div>
        </>
      ) : null}
    </section>
  );
}
