import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';
import logoReduced from '../assets/logo_reduced.png';

type BrandProps = {
  footer?: boolean;
};

export default function Brand({ footer = false }: BrandProps) {
  return (
    <Link
      className={`brand${footer ? ' brand--footer' : ''}`}
      to="/"
      aria-label="Benefy, ir al inicio"
    >
      <img
        className={`brand-image${footer ? ' brand-image-full' : ''}`}
        src={footer ? logo : logoReduced}
        alt={footer ? 'Benefy' : ''}
        width="1080"
        height="1080"
      />
      {!footer && <span className="brand-name">Benefy</span>}
    </Link>
  );
}
