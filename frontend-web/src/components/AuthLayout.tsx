import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faUser } from '@fortawesome/free-solid-svg-icons';
import logo from '../assets/LogoR.png';

type AuthLayoutProps = {
  children: ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="auth-shell">
      <header className="auth-header">
        <div className="auth-header-inner">
          <div className="auth-brand">
            <img className="auth-brand-logo" src={logo} alt="Benefy" width="500" height="331" />
            <span className="auth-brand-name">Benefy</span>
            <span className="auth-badge">B2B Portal</span>
          </div>
          <nav className="auth-nav" aria-label="Portal">
            <Link to="/">Volver al sitio</Link>
            <Link to="/precios">Centro de Ayuda / Soporte</Link>
            <span className="auth-avatar" aria-hidden="true">
              <FontAwesomeIcon icon={faUser} />
            </span>
          </nav>
        </div>
      </header>

      <main className="auth-main">{children}</main>

      <footer className="auth-footer">
        <div className="auth-footer-inner">
          <Link className="auth-back" to="/">
            <FontAwesomeIcon icon={faArrowLeft} />
            Volver al sitio web
          </Link>
          <div className="auth-footer-links">
            <Link to="/">Términos de Servicio</Link>
            <span aria-hidden="true">•</span>
            <Link to="/">Privacidad</Link>
            <span aria-hidden="true">•</span>
            <span className="auth-copy">© 2025 Benefy Technologies</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function GoogleMark() {
  return (
    <svg className="auth-google" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function MicrosoftMark() {
  return (
    <svg className="auth-google" viewBox="0 0 23 23" aria-hidden="true">
      <path d="M1 1h10v10H1z" fill="#f35325" />
      <path d="M12 1h10v10H12z" fill="#81bc06" />
      <path d="M1 12h10v10H1z" fill="#05a6f0" />
      <path d="M12 12h10v10H12z" fill="#ffba08" />
    </svg>
  );
}
