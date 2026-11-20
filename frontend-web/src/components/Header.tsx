import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import Icon from './Icon.tsx';
import Brand from './Brand.tsx';

const links: [string, string][] = [
  ['Producto', '/#producto'],
  ['Cómo funciona', '/#como-funciona'],
  ['Casos de uso', '/#casos'],
  ['Planes', '/#planes'],
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Brand />
        <nav
          id="primary-navigation"
          className={open ? 'nav nav-open' : 'nav'}
          aria-label="Navegación principal"
        >
          {links.map(([label, href]) => (
            <Link
              key={label}
              to={href}
              className="nav-link"
              onClick={() => setOpen(false)}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <NavLink className="login" to="/login">Iniciar sesión</NavLink>
          <NavLink className="button button-small" to="/registro">
            Crear negocio
          </NavLink>
          <NavLink className="account" to="/login" aria-label="Cuenta">
            <Icon name="person" />
          </NavLink>
        </div>
        <button
          className="menu-toggle"
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={open}
          aria-controls="primary-navigation"
        >
          <Icon name={open ? 'close' : 'menu'} />
        </button>
      </div>
    </header>
  );
}
