import { Link } from 'react-router-dom';
import Brand from './Brand.tsx';

type FooterColumn = [string, [string, string][]];

const columns: FooterColumn[] = [
  [
    'Producto',
    [
      ['Cómo funciona', '/#como-funciona'],
      ['Funciones', '/#producto'],
      ['Planes', '/#planes'],
    ],
  ],
  [
    'Para tu negocio',
    [
      ['Casos de uso', '/#casos'],
      ['Crear una cuenta', '/registro'],
      ['Iniciar sesión', '/login'],
    ],
  ],
  [
    'Benefy',
    [
      ['Sobre nosotros', '/about'],
      ['Preguntas frecuentes', '/#preguntas'],
      ['Portal de negocios', '/login'],
    ],
  ],
];

export default function Footer() {
  return (
    <footer className="footer" id="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Brand footer />
            <p>
              Programas de puntos, sellos y cupones con control por negocio,
              sucursal y equipo.
            </p>
            <Link to="/#producto">Conoce el producto</Link>
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
          <span>© 2026 Benefy. Plataforma de fidelización para negocios.</span>
          <span>Hecho para operar la lealtad desde la primera visita.</span>
        </div>
      </div>
    </footer>
  );
}
