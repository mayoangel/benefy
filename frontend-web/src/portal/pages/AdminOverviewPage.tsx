import { PortalIcon, PortalPageHeader, PortalTable, PortalRoleBadge } from '../components/PortalUI';
import { useRequestGuard } from '../hooks/useRequestGuard';
import { useCallback, useEffect, useState } from 'react';

import logoMark from '../../assets/logo_no_name.png';
import { api } from '../../lib/api.ts';
import { planLabel } from '../../lib/planLabels.ts';
import type { NegocioResumen, UsuarioResumen } from '../../lib/types.ts';
import { PortalError, PortalLoading } from '../components/PortalState.tsx';

function BusinessLogo({ src }: { src?: string | null }) {
  const [failed, setFailed] = useState(false);
  const usesFallback = !src || failed;

  return (
    <span className={`portal-entity-logo${usesFallback ? ' is-benefy' : ''}`} aria-hidden="true">
      <img
        src={usesFallback ? logoMark : src}
        alt=""
        width={usesFallback ? 488 : 40}
        height={usesFallback ? 319 : 40}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </span>
  );
}

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
          return [negocio.id, planLabel(detalle.plan)] as const;
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

  const activeBusinesses = negocios.filter((negocio) => negocio.status).length;
  const adminUsers = usuarios.filter((usuario) => usuario.rol === 'admin_sistema').length;

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
            <article className="portal-kpi portal-admin-kpi">
              <div className="portal-admin-kpi-head">
                <span>Negocios</span>
                <span className="portal-admin-kpi-icon" aria-hidden="true">
                  <img src={logoMark} alt="" width="488" height="319" />
                </span>
              </div>
              <strong>{negocios.length}</strong>
              <small>{activeBusinesses} {activeBusinesses === 1 ? 'activo' : 'activos'}</small>
            </article>
            <article className="portal-kpi portal-admin-kpi">
              <div className="portal-admin-kpi-head">
                <span>Usuarios</span>
                <span className="portal-admin-kpi-icon" aria-hidden="true"><PortalIcon name="equipo" /></span>
              </div>
              <strong>{usuarios.length}</strong>
              <small>{adminUsers} {adminUsers === 1 ? 'administrador' : 'administradores'}</small>
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
                        <td>
                          <div className="portal-entity-cell">
                            <BusinessLogo src={negocio.logo_url} />
                            <span>{negocio.nombre}</span>
                          </div>
                        </td>
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
