import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import Icon from './Icon.tsx';
import Brand from './Brand.tsx';

const links: [string, string][] = [
  ['Inicio', '/'],
  ['Sobre nosotros', '/about'],
  ['Precios', '/precios'],
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
            <NavLink
              end={href === '/'}
              key={label}
              to={href}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              onClick={() => setOpen(false)}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="header-actions">
          <a className="login" href="#footer">Iniciar sesión</a>
          <NavLink className="button button-small" to="/precios">
            Comenzar gratis
          </NavLink>
          <a className="account" href="#footer" aria-label="Cuenta">
            <Icon name="person" />
          </a>
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
