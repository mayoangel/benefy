import { useParams } from 'react-router-dom';

import { useAuth } from '../../auth/AuthProvider.tsx';

export default function BranchesPage() {
  const { context } = useAuth();
  const { negocioId } = useParams();
  const id = Number(negocioId);
  const sucursales = context?.sucursales.filter((sucursal) => sucursal.negocio === id) ?? [];

  return (
    <section className="portal-page">
      <header className="portal-page-head">
        <div>
          <span className="portal-eyebrow">Negocio</span>
          <h1>Sucursales</h1>
          <p>Sucursales a las que tienes acceso según tu membresía.</p>
        </div>
      </header>

      <div className="portal-panel">
        {sucursales.length === 0 ? (
          <p className="portal-muted">No hay sucursales activas disponibles.</p>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr><th>ID</th><th>Sucursal</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {sucursales.map((sucursal) => (
                  <tr key={sucursal.id}>
                    <td>{sucursal.id}</td>
                    <td>{sucursal.nombre}</td>
                    <td><span className={sucursal.status ? 'portal-badge is-on' : 'portal-badge'}>{sucursal.status ? 'Activa' : 'Inactiva'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
