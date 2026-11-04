import { Link } from 'react-router-dom';
import Brand from './Brand.tsx';

type FooterColumn = [string, [string, string][]];

const columns: FooterColumn[] = [
  [
    'Soluciones',
    [
      ['Planes corporativos', '/precios'],
      ['Programa de partners', '/about#valores'],
      ['Vouchers y beneficios', '/precios'],
    ],
  ],
  [
    'Compañía',
    [
      ['Sobre nosotros', '/about'],
      ['Inicio', '/'],
      ['Soporte B2B', '/precios'],
    ],
  ],
  [
    'Legal & seguridad',
    [
      ['Términos de servicio', '/'],
      ['Política de privacidad', '/'],
      ['Cumplimiento fiscal', '/precios'],
    ],
  ],
];

export default function Footer() {
  return (
    <footer className="footer" id="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Brand />
            <p>
              Recompensas que conectan comercios y comunidades. Tecnología
              cercana para crecer en compañía.
            </p>
            <Link to="/precios">Conoce los planes ↗</Link>
          </div>
          {columns.map(([title, links]) => (
            <div className="footer-column" key={title}>
              <h3>{title}</h3>
              {links.map(([label, href]) => (
                <Link to={href} key={label}>
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="footer-bottom">
          <span>© 2026 Benefy Technologies. Todos los derechos reservados.</span>
          <span>
            Soporte operacional y contacto corporativo pendiente de confirmación
            oficial.
          </span>
        </div>
      </div>
    </footer>
  );
}
