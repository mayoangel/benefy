import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBagShopping,
  faBuilding,
  faChartColumn,
  faCheck,
  faCircleCheck,
  faGift,
  faMugHot,
  faQrcode,
  faScissors,
  faStamp,
  faStore,
  faTicket,
  faUsers,
  faUtensils,
} from '@fortawesome/free-solid-svg-icons';

import Icon from '../components/Icon.tsx';
import PlansSection from '../components/PlansSection.tsx';
import couponsAsset from '../assets/coupons.png';
import logoMark from '../assets/logo_no_name.png';
import pointsAsset from '../assets/points.png';

const features = [
  {
    title: 'Puntos por visita',
    copy: 'Define cuántos puntos entrega cada visita, su vigencia y el costo de cada recompensa. El consumo usa primero los puntos más antiguos.',
    image: pointsAsset,
    icon: null,
  },
  {
    title: 'Tarjetas de sellos',
    copy: 'Configura una meta, enlaza la recompensa y decide si la tarjeta vuelve a empezar cuando el cliente la completa.',
    image: null,
    icon: faStamp,
  },
  {
    title: 'Cupones y canjes',
    copy: 'Entrega beneficios gratis, descuentos porcentuales o montos fijos con vigencia, disponibilidad y un canje único por cupón.',
    image: couponsAsset,
    icon: null,
  },
  {
    title: 'Negocio y sucursales',
    copy: 'Organiza la operación por sucursal, conserva un QR propio para cada ubicación y consulta actividad con el alcance correcto.',
    image: null,
    icon: faBuilding,
  },
  {
    title: 'Equipo con alcance claro',
    copy: 'El dueño administra el negocio; supervisores y empleados operan desde la sucursal a la que fueron asignados.',
    image: null,
    icon: faUsers,
  },
  {
    title: 'Seguimiento operativo',
    copy: 'Revisa visitas válidas, clientes únicos, puntos, cupones, tarjetas completadas, canjes y recompensas más utilizadas.',
    image: null,
    icon: faChartColumn,
  },
];

const steps = [
  {
    icon: faStore,
    title: 'Configura el negocio',
    copy: 'Registra tu negocio, sucursales y equipo. Cada negocio nuevo recibe el plan Free automáticamente.',
  },
  {
    icon: faGift,
    title: 'Diseña la recompensa',
    copy: 'Crea un programa de puntos o una tarjeta de sellos y enlaza beneficios con reglas visibles para tu cliente.',
  },
  {
    icon: faQrcode,
    title: 'Registra la visita',
    copy: 'La visita se identifica con el QR del negocio o de la sucursal y actualiza el progreso correspondiente.',
  },
  {
    icon: faCircleCheck,
    title: 'Canjea y da seguimiento',
    copy: 'El cliente usa su cupón, el equipo valida el canje y el portal conserva el registro para medir la actividad.',
  },
];

const cases = [
  {
    icon: faMugHot,
    title: 'Cafeterías y panaderías',
    copy: 'Una tarjeta de visitas para el café habitual y puntos para recompensas adicionales.',
    example: 'Ejemplo: completa 7 sellos y recibe una bebida.',
  },
  {
    icon: faUtensils,
    title: 'Restaurantes',
    copy: 'Puntos por visita y cupones con vigencia para convertir una recompensa en una próxima ocasión de consumo.',
    example: 'Ejemplo: 20% de descuento con 120 puntos.',
  },
  {
    icon: faScissors,
    title: 'Belleza y bienestar',
    copy: 'Reconoce la frecuencia de citas y administra el programa por sucursal y por equipo operativo.',
    example: 'Ejemplo: un servicio de cortesía al completar la tarjeta.',
  },
  {
    icon: faBagShopping,
    title: 'Comercio especializado',
    copy: 'Combina recompensas con stock, descuentos fijos o porcentuales y un historial claro de canjes.',
    example: 'Ejemplo: cupón de $100 MXN para la siguiente visita.',
  },
];

const faqs: [string, string][] = [
  [
    '¿Qué incluye realmente el plan Free?',
    'Incluye 1 sucursal, 1 programa de puntos, 2 tarjetas de sellos, 5 recompensas, 1 supervisor y 3 empleados activos. Clientes, visitas y cupones no tienen límite de plan.',
  ],
  [
    '¿Qué cambia hoy al pasar a Premium?',
    'Premium amplía la capacidad a 5 sucursales, 10 tarjetas, 30 recompensas, 5 supervisores y 20 empleados. Las funciones avanzadas configuradas para fases futuras todavía no se anuncian como disponibles.',
  ],
  [
    '¿Premium se puede comprar en línea?',
    'Todavía no. El sistema contempla precios y suscripciones, pero Stripe, cobro y facturación no están implementados. La activación actual se realiza manualmente con el equipo de Benefy.',
  ],
  [
    '¿Cómo se acumulan y vencen los puntos?',
    'El negocio define los puntos por visita y puede configurar días de vigencia. Al canjear una recompensa, Benefy consume primero los lotes de puntos más antiguos.',
  ],
  [
    '¿Qué ocurre si un negocio baja de Premium a Free?',
    'No se elimina información. Los recursos que superen el límite se conservan y pueden consultarse, pero no se permiten nuevas altas en esas categorías hasta regularizar el uso.',
  ],
  [
    '¿Todos los integrantes del equipo ven lo mismo?',
    'No. El dueño administra el negocio completo. Supervisores y empleados trabajan con el alcance de su sucursal; el portal adapta navegación y permisos a cada rol.',
  ],
];

function Hero() {
  return (
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="container landing-hero-grid">
        <div className="landing-hero-copy">
          <span className="landing-kicker landing-kicker-light">Lealtad que tu negocio puede operar</span>
          <h1 id="landing-title">Premia cada visita y controla tu programa desde un solo lugar.</h1>
          <p>
            Benefy reúne puntos, tarjetas de sellos, recompensas, cupones y canjes
            en una plataforma con control por negocio, sucursal y equipo.
          </p>
          <div className="landing-actions">
            <Link className="landing-button landing-button-mint" to="/registro">Crear mi negocio gratis</Link>
            <Link className="landing-text-link" to="/#como-funciona">Ver cómo funciona</Link>
          </div>
          <ul className="landing-hero-facts" aria-label="Capacidades principales">
            <li><FontAwesomeIcon icon={faCheck} /> Plan Free permanente</li>
            <li><FontAwesomeIcon icon={faCheck} /> QR por negocio y sucursal</li>
            <li><FontAwesomeIcon icon={faCheck} /> Roles de operación</li>
          </ul>
        </div>

        <div className="landing-product-preview" aria-label="Vista ilustrativa del portal de Benefy">
          <div className="preview-toolbar">
            <span className="preview-brand"><img src={logoMark} alt="" width="488" height="319" decoding="async" /> Benefy</span>
            <span>Vista del portal</span>
          </div>
          <div className="preview-heading">
            <div><small>Resumen del negocio</small><strong>Café Nómada</strong></div>
            <span>Datos de ejemplo</span>
          </div>
          <div className="preview-metrics">
            <div><span>Visitas válidas</span><strong>1,248</strong><small>Últimos 30 días</small></div>
            <div><span>Clientes únicos</span><strong>386</strong><small>Con al menos una visita</small></div>
            <div><span>Cupones canjeados</span><strong>58</strong><small>En el negocio</small></div>
          </div>
          <div className="preview-programs">
            <article>
              <img src={pointsAsset} alt="" width="2048" height="2048" decoding="async" />
              <div><span>Programa de puntos</span><strong>10 puntos por visita</strong></div>
              <small>Activo</small>
            </article>
            <article>
              <span className="preview-stamp"><FontAwesomeIcon icon={faStamp} /></span>
              <div><span>Tarjeta de sellos</span><strong>Tu café de siempre</strong></div>
              <small>6 / 7</small>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

function ValueProposition() {
  return (
    <section className="landing-value" aria-labelledby="value-title">
      <div className="container landing-value-grid">
        <div className="landing-section-head landing-value-head">
          <span className="landing-kicker">Una operación conectada</span>
          <h2 id="value-title">Del programa de lealtad al canje, sin perder el contexto.</h2>
        </div>
        <div className="landing-value-points">
          <article><span>01</span><h3>Reglas configurables</h3><p>Metas, conversión, vigencia, stock y condiciones viven en el programa.</p></article>
          <article><span>02</span><h3>Operación por sucursal</h3><p>Visitas, canjes y personal conservan el lugar donde ocurrió cada acción.</p></article>
          <article><span>03</span><h3>Actividad trazable</h3><p>El portal reúne clientes, puntos, cupones y resultados por periodo.</p></article>
        </div>
      </div>
    </section>
  );
}

function ProductFeatures() {
  return (
    <section className="landing-section landing-features" id="producto" aria-labelledby="features-title">
      <div className="container">
        <div className="landing-section-head">
          <span className="landing-kicker">El producto de hoy</span>
          <h2 id="features-title">Funciones que ya forman parte de la operación.</h2>
          <p>Cada módulo responde a un flujo real del sistema, desde crear la dinámica hasta consultar lo que ocurrió en cada sucursal.</p>
        </div>
        <div className="landing-feature-grid">
          {features.map((feature, index) => (
            <article className={`landing-feature landing-feature-${index + 1}`} key={feature.title}>
              <span className="landing-feature-icon" aria-hidden="true">
                {feature.image ? (
                  <img src={feature.image} alt="" width="2048" height="2048" loading="lazy" decoding="async" />
                ) : (
                  <FontAwesomeIcon icon={feature.icon!} />
                )}
              </span>
              <h3>{feature.title}</h3>
              <p>{feature.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="landing-section landing-how" id="como-funciona" aria-labelledby="how-title">
      <div className="container">
        <div className="landing-section-head landing-section-head-light">
          <span className="landing-kicker landing-kicker-light">Cómo funciona</span>
          <h2 id="how-title">Un flujo claro para el negocio y para el cliente.</h2>
          <p>La configuración, la visita, el beneficio y el seguimiento comparten la misma lógica.</p>
        </div>
        <div className="landing-steps">
          {steps.map((step, index) => (
            <article key={step.title}>
              <div className="landing-step-top"><span><FontAwesomeIcon icon={step.icon} /></span><small>0{index + 1}</small></div>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
        <div className="landing-customer-flow">
          <div>
            <span className="landing-kicker landing-kicker-light">Experiencia del cliente</span>
            <h3>Saldo, progreso y beneficios con un historial común.</h3>
          </div>
          <div className="customer-flow-items">
            <span><FontAwesomeIcon icon={faQrcode} /> Registra la visita</span>
            <span><img src={pointsAsset} alt="" width="2048" height="2048" loading="lazy" decoding="async" /> Acumula puntos o sellos</span>
            <span><img src={couponsAsset} alt="" width="2048" height="2048" loading="lazy" decoding="async" /> Obtiene un cupón</span>
            <span><FontAwesomeIcon icon={faTicket} /> Inicia el canje</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function UseCases() {
  return (
    <section className="landing-section landing-cases" id="casos" aria-labelledby="cases-title">
      <div className="container">
        <div className="landing-section-head landing-cases-head">
          <span className="landing-kicker">Casos de uso</span>
          <h2 id="cases-title">La misma base, configurada para hábitos distintos.</h2>
          <p>Estos ejemplos muestran cómo combinar las capacidades existentes de Benefy según la frecuencia de visita.</p>
        </div>
        <div className="landing-case-grid">
          {cases.map((item) => (
            <article key={item.title}>
              <span><FontAwesomeIcon icon={item.icon} /></span>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
              <small>{item.example}</small>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="landing-section landing-faq" id="preguntas" aria-labelledby="faq-title">
      <div className="container landing-faq-layout">
        <div className="landing-section-head landing-faq-head">
          <span className="landing-kicker">Sin letra pequeña</span>
          <h2 id="faq-title">Preguntas sobre el producto actual.</h2>
          <p>Respuestas alineadas con lo que está implementado hoy y con los límites reales del sistema.</p>
        </div>
        <div className="landing-faq-list">
          {faqs.map(([question, answer], index) => {
            const isOpen = open === index;
            const panelId = `landing-faq-${index}`;
            return (
              <article className={isOpen ? 'is-open' : ''} key={question}>
                <button type="button" aria-expanded={isOpen} aria-controls={panelId} onClick={() => setOpen(isOpen ? null : index)}>
                  <span>{question}</span>
                  <Icon name={isOpen ? 'expand_less' : 'expand_more'} />
                </button>
                {isOpen && <p id={panelId}>{answer}</p>}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="landing-final-cta" aria-labelledby="final-cta-title">
      <div className="container landing-final-cta-inner">
        <div>
          <span className="landing-kicker landing-kicker-light">Tu primer programa empieza en Free</span>
          <h2 id="final-cta-title">Configura una lealtad que tu equipo sí pueda operar.</h2>
          <p>Crea el negocio, define la recompensa y empieza con los límites reales del plan gratuito.</p>
        </div>
        <div className="landing-actions">
          <Link className="landing-button landing-button-mint" to="/registro">Crear mi cuenta</Link>
          <Link className="landing-text-link landing-text-link-light" to="/login">Ya tengo una cuenta</Link>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  useEffect(() => {
    const previousTitle = document.title;
    const title = 'Benefy | Puntos, sellos y cupones para tu negocio';
    const description = 'Benefy permite operar programas de puntos, tarjetas de sellos, recompensas, cupones y canjes con control por sucursal y equipo.';
    const managedMeta: HTMLMetaElement[] = [];

    document.title = title;
    const setMeta = (attribute: 'name' | 'property', key: string, content: string) => {
      let meta = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attribute, key);
        document.head.appendChild(meta);
        managedMeta.push(meta);
      }
      meta.content = content;
    };

    setMeta('name', 'description', description);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', 'website');

    return () => {
      document.title = previousTitle;
      managedMeta.forEach((meta) => meta.remove());
    };
  }, []);

  return (
    <main className="landing-page">
      <Hero />
      <ValueProposition />
      <ProductFeatures />
      <HowItWorks />
      <UseCases />
      <PlansSection />
      <FAQ />
      <FinalCTA />
    </main>
  );
}
