import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faCrown, faSeedling } from '@fortawesome/free-solid-svg-icons';
import { Reveal } from './LandingMotion.tsx';

type PlansSectionProps = {
  headingLevel?: 'h1' | 'h2';
  intro?: string;
};

const plans = [
  {
    code: 'free',
    name: 'Plan gratis',
    eyebrow: 'Para empezar',
    icon: faSeedling,
    price: '$0',
    cadence: 'sin costo, sin plazo forzoso',
    summary: 'Todo lo necesario para abrir tu programa de lealtad y atender a tus primeros clientes.',
    features: [
      '1 sucursal activa',
      '1 programa de puntos activo',
      '2 tarjetas de sellos activas',
      '5 recompensas activas',
      '1 supervisor y 3 empleados',
      'Clientes, visitas y cupones ilimitados',
    ],
    action: 'Empezar gratis',
    to: '/registro',
    note: 'Incluye acceso completo al portal y a la app para tus clientes.',
  },
  {
    code: 'premium',
    name: 'Plan premium',
    eyebrow: 'Para crecer',
    icon: faCrown,
    price: '$399',
    cadence: 'MXN / mes',
    summary: 'Más sucursales, más equipo y más beneficios activos para una operación en expansión.',
    features: [
      'Hasta 5 sucursales activas',
      '1 programa de puntos activo',
      '10 tarjetas de sellos activas',
      '30 recompensas activas',
      '5 supervisores y 20 empleados',
      'Clientes, visitas y cupones ilimitados',
    ],
    action: 'Conocer el plan premium',
    to: '/precios#contacto',
    note: 'También disponible por $3,990 MXN al año.',
  },
];

export default function PlansSection({
  headingLevel = 'h2',
  intro = 'Empieza con el plan gratis y amplía tu operación cuando lo necesites.',
}: PlansSectionProps) {
  const Heading = headingLevel;

  return (
    <section className="landing-section plans-section" id="planes" aria-labelledby="plans-title">
      <div className="container">
        <Reveal className="landing-section-head plans-section-head">
          <span className="landing-kicker">Planes para tu negocio</span>
          <Heading id="plans-title">Empieza gratis. Crece cuando tu negocio lo necesite.</Heading>
          <p>{intro}</p>
        </Reveal>

        <Reveal className="plans-grid" delay={0.05}>
          {plans.map((plan) => (
            <article className={`real-plan real-plan-${plan.code}`} key={plan.code}>
              <div className="real-plan-head">
                <span className="real-plan-icon" aria-hidden="true">
                  <FontAwesomeIcon icon={plan.icon} />
                </span>
                <div>
                  <span>{plan.eyebrow}</span>
                  <h3>{plan.name}</h3>
                </div>
              </div>
              <p className="real-plan-summary">{plan.summary}</p>
              <div className="real-plan-price">
                <strong>{plan.price}</strong>
                <span>{plan.cadence}</span>
              </div>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <FontAwesomeIcon icon={faCheck} aria-hidden="true" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="real-plan-bottom">
                <Link className={`landing-button${plan.code === 'premium' ? ' landing-button-light' : ''}`} to={plan.to}>
                  {plan.action}
                </Link>
                <small>{plan.note}</small>
              </div>
            </article>
          ))}
        </Reveal>

        <Reveal delay={0.08}>
          <p className="plans-truth-note">
            El plan premium amplía la capacidad de sucursales, tarjetas, recompensas
            y equipo. Puedes cambiar de plan desde el portal cuando tu operación lo
            necesite; tu historial y tus datos se conservan.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
