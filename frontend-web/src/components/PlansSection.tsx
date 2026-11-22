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
    name: 'Free',
    icon: faSeedling,
    price: '$0',
    cadence: 'sin límite de tiempo',
    summary: 'Para poner en marcha un programa completo en un negocio pequeño.',
    features: [
      '1 sucursal activa',
      '1 programa de puntos activo',
      '2 tarjetas de sellos activas',
      '5 recompensas activas',
      '1 supervisor y 3 empleados',
      'Clientes, visitas y cupones ilimitados',
    ],
    action: 'Empezar con Free',
    to: '/registro',
    note: 'Se asigna automáticamente al registrar un negocio.',
  },
  {
    code: 'premium',
    name: 'Premium',
    icon: faCrown,
    price: '$899',
    cadence: 'MXN/mes · referencia',
    summary: 'Para operaciones que necesitan más sucursales, equipo, tarjetas y recompensas activas.',
    features: [
      'Hasta 5 sucursales activas',
      '1 programa de puntos activo',
      '10 tarjetas de sellos activas',
      '30 recompensas activas',
      '5 supervisores y 20 empleados',
      'Clientes, visitas y cupones ilimitados',
    ],
    action: 'Conocer Premium',
    to: '/precios#contacto',
    note: 'Precio orientativo. La activación actual es manual.',
  },
];

export default function PlansSection({
  headingLevel = 'h2',
  intro = 'Dos niveles reales, definidos por la capacidad que necesita tu operación.',
}: PlansSectionProps) {
  const Heading = headingLevel;

  return (
    <section className="landing-section plans-section" id="planes" aria-labelledby="plans-title">
      <div className="container">
        <Reveal className="landing-section-head plans-section-head">
          <span className="landing-kicker">Planes reales del producto</span>
          <Heading id="plans-title">Empieza gratis. Amplía cuando tu operación lo pida.</Heading>
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
                  <span>Plan</span>
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
            Premium amplía los límites operativos. Analítica avanzada, exportación,
            personalización y alianzas figuran en el esquema futuro del plan, pero todavía
            no están disponibles y no se incluyen como beneficios actuales.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
