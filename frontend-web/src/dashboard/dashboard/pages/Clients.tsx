import { useState } from 'react';
import Card from '../components/Card';
import Metrics from '../components/Metric';
import Chart from '../components/Chart';
import EmptyState from '../components/EmptyState';
import { clients } from '../data/demoData';
import { number } from '../data/format';
import { periodScale } from '../data/period';
import { useDemoData } from '../data/DemoDataProvider';
export const maskEmail = (email: string) => { const [name, domain] = email.split('@'); return `${name.slice(0, 2)}***@${domain}`; };
export default function Clients() {
  const [search, setSearch] = useState(''); const [page, setPage] = useState(1);
  const { period } = useDemoData();
  const filtered = clients.filter(client => client.name.toLocaleLowerCase('es-MX').includes(search.trim().toLocaleLowerCase('es-MX')));
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  return <>
    <div className="bd-inline-note">Estadísticas de consulta. Los datos personales se administran desde las cuentas de los clientes.</div>
    <Metrics />
    <Chart clients />
    <Card title="Ranking de participación">
      <p className="bd-muted">Ranking de uso interno del comercio</p>
      <label className="bd-search">Buscar por nombre<input type="search" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Nombre del cliente" />
      </label>{filtered.length ? <>
        <div className="bd-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Posición</th>
                <th>Cliente</th>
                <th>Correo</th>
                <th>Visitas</th>
              </tr>
            </thead>
            <tbody>{filtered.slice((page - 1) * 10, page * 10).map((client, index) => <tr key={client.id}>
              <td>{number((page - 1) * 10 + index + 1)}</td>
              <td>{client.name}</td>
              <td>{maskEmail(client.email)}</td>
              <td>{number(Math.round(client.visits * periodScale(period)))}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <nav className="bd-pagination" aria-label="Páginas del ranking">
          <button className="bd-secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button>
          <span role="status">Página {number(page)} de {number(pages)}</span>
          <button className="bd-secondary" disabled={page === pages} onClick={() => setPage(page + 1)}>Siguiente</button>
        </nav>
      </> : <EmptyState message="No encontramos clientes con ese nombre" action="Limpiar búsqueda" onAction={() => setSearch('')} />}</Card>
  </>;
}
