import { Link } from 'react-router-dom';
import logo from '../assets/LogoR.png';

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
      <img className="brand-image" src={logo} alt="Benefy" width="500" height="331" />
      <span className="brand-name">Benefy</span>
    </Link>
  );
}
