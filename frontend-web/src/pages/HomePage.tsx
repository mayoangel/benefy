import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBagShopping,
  faBuilding,
  faChartColumn,
  faCheck,
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
import { LandingMotionProvider, Reveal } from '../components/LandingMotion.tsx';
import PlansSection from '../components/PlansSection.tsx';
import couponsAsset from '../assets/coupons.png';
import logoMark from '../assets/logo_no_name.png';
import pointsAsset from '../assets/points.png';

const features = [
  {
    title: 'Puntos por visita',
    copy: 'Define cuántos puntos gana cada visita, cuánto duran y qué recompensas puede obtener tu cliente. Así cada compra tiene un siguiente paso claro.',
    image: pointsAsset,
    icon: null,
  },
  {
    title: 'Tarjetas de sellos',
    copy: 'Crea una meta sencilla, enlaza el premio y decide si la tarjeta se renueva al completarse. Ideal para cafeterías, barberías y servicios recurrentes.',
    image: null,
    icon: faStamp,
  },
  {
    title: 'Cupones y canjes',
    copy: 'Entrega beneficios gratis, descuentos porcentuales o montos fijos con vigencia y disponibilidad controladas. Cada cupón se valida una sola vez.',
    image: couponsAsset,
    icon: null,
  },
  {
    title: 'Un negocio, todas tus sucursales',
    copy: 'Administra tu negocio desde un solo lugar y añade sucursales para cada establecimiento. Cada ubicación tiene su propio QR y su actividad.',
    image: null,
    icon: faBuilding,
  },
  {
    title: 'Equipo con alcance claro',
    copy: 'Tú administras el negocio completo. Supervisores y empleados operan desde la sucursal que les corresponde, con accesos claros.',
    image: null,
    icon: faUsers,
  },
  {
    title: 'Seguimiento operativo',
    copy: 'Consulta visitas, clientes únicos, puntos, cupones, tarjetas completadas y las recompensas que más se canjean.',
    image: null,
    icon: faChartColumn,
  },
];

const steps = [
  {
    icon: faStore,
    title: 'Configura',
    copy: 'Registra tu negocio, define puntos o tarjetas de sellos y prepara tus recompensas. Empiezas con el plan gratis.',
  },
  {
    icon: faQrcode,
    title: 'Registra',
    copy: 'Tu cliente escanea el QR de la sucursal y su visita queda registrada al instante, sin aplicaciones complicadas.',
  },
  {
    icon: faGift,
    title: 'Recompensa',
    copy: 'Al alcanzar su meta, tu cliente recibe un cupón o beneficio que el equipo valida una sola vez en caja.',
  },
  {
    icon: faChartColumn,
    title: 'Mide',
    copy: 'Consulta visitas, clientes, canjes y actividad por sucursal para ajustar tu programa con información clara.',
  },
];

const cases = [
  {
    icon: faMugHot,
    title: 'Cafeterías y panaderías',
    copy: 'Convierte la visita diaria en una costumbre con una tarjeta de sellos y un premio que invite a volver.',
    example: 'Idea: completa 7 visitas y recibe una bebida de la casa.',
  },
  {
    icon: faUtensils,
    title: 'Restaurantes',
    copy: 'Reconoce a tus clientes frecuentes y dales una razón para volver con puntos y cupones de temporada.',
    example: 'Idea: 20% de descuento en su siguiente visita.',
  },
  {
    icon: faScissors,
    title: 'Belleza y bienestar',
    copy: 'Premia la constancia de tus clientes y organiza el programa por sucursal y por equipo.',
    example: 'Idea: un servicio de cortesía al completar la tarjeta.',
  },
  {
    icon: faBagShopping,
    title: 'Comercio especializado',
    copy: 'Combina recompensas, descuentos y un historial de canjes fácil de consultar para tu equipo.',
    example: 'Idea: cupón de $100 MXN para la siguiente compra.',
  },
];

const faqs: [string, string][] = [
  [
    '¿Cómo funciona Benefy?',
    'Creas tu programa de lealtad, registras las visitas de tus clientes y entregas recompensas y cupones. Todo se administra desde un mismo portal, con la actividad separada por negocio y sucursal.',
  ],
  [
    '¿Qué necesito para registrar mi negocio?',
    'Una cuenta con correo electrónico, el nombre comercial de tu negocio y su categoría. Puedes completar la dirección, el equipo y las sucursales después.',
  ],
  [
    '¿Puedo administrar varias sucursales?',
    'Sí. Cada cuenta administra un negocio y puede añadir varias sucursales, cada una con su propio QR y su actividad. El plan contratado define cuántas sucursales puedes mantener activas.',
  ],
  [
    '¿Puedo registrar más de un negocio con la misma cuenta?',
    'Cada cuenta administra un negocio activo y todas las sucursales que necesite. Si operas marcas independientes, necesitas una cuenta distinta para cada negocio.',
  ],
  [
    '¿Cómo registran sus visitas los clientes?',
    'Tus clientes escanean el QR del negocio o de la sucursal desde su teléfono. La visita queda asociada a su cuenta y actualiza sus puntos o sellos automáticamente.',
  ],
  [
    '¿Qué incluye el plan gratis?',
    'Incluye una sucursal, un programa de puntos, dos tarjetas de sellos, cinco recompensas, un supervisor y tres empleados activos. Los clientes, visitas y cupones no tienen límite de plan.',
  ],
  [
    '¿Qué ventajas ofrece el plan premium?',
    'Amplía la capacidad a cinco sucursales, diez tarjetas de sellos, treinta recompensas, cinco supervisores y veinte empleados. También habilita más capacidad para alianzas comerciales.',
  ],
  [
    '¿Puedo cambiar de plan?',
    'Sí. Puedes contratar o cambiar tu plan desde la sección de Suscripción del portal. Tus datos e historial se conservan; si vuelves al plan gratis, los recursos que superen el límite se mantienen consultables.',
  ],
  [
    '¿Cómo funcionan las alianzas entre negocios?',
    'Dos negocios pueden acordar un beneficio para los clientes del otro. El plan gratis permite recibir y aceptar alianzas dentro de su cupo; el plan premium permite proponer alianzas y ampliar la capacidad.',
  ],
  [
    '¿Todos los integrantes del equipo ven lo mismo?',
    'No. El propietario administra el negocio completo. Supervisores y empleados trabajan con el alcance de su sucursal, y el portal adapta la navegación y los permisos a cada rol.',
  ],
];

function Hero() {
  return (
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="container landing-hero-grid">
        <Reveal className="landing-hero-copy" mode="load">
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
            <li><FontAwesomeIcon icon={faCheck} /> Plan gratis para empezar</li>
            <li><FontAwesomeIcon icon={faCheck} /> QR por sucursal</li>
            <li><FontAwesomeIcon icon={faCheck} /> Un negocio, varias sucursales</li>
          </ul>
        </Reveal>

        <Reveal className="landing-product-preview" mode="load" delay={0.12}>
          <div className="preview-toolbar">
            <span className="preview-brand"><img src={logoMark} alt="" width="488" height="319" decoding="async" /> Benefy</span>
            <span>Vista del portal</span>
          </div>
          <div className="preview-heading">
            <div><small>Resumen del negocio</small><strong>Café Nómada</strong></div>
            <span>Negocio activo</span>
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
        </Reveal>
      </div>
    </section>
  );
}

function ValueProposition() {
  return (
    <section className="landing-value" aria-labelledby="value-title">
      <Reveal className="container landing-value-grid">
        <div className="landing-section-head landing-value-head">
          <span className="landing-kicker">Una operación conectada</span>
          <h2 id="value-title">Del programa de lealtad al canje, sin perder el contexto.</h2>
        </div>
        <div className="landing-value-points">
          <article><span>01</span><h3>Reglas configurables</h3><p>Metas, conversión, vigencia, stock y condiciones viven en el programa.</p></article>
          <article><span>02</span><h3>Operación por sucursal</h3><p>Visitas, canjes y personal conservan el lugar donde ocurrió cada acción.</p></article>
          <article><span>03</span><h3>Actividad trazable</h3><p>El portal reúne clientes, puntos, cupones y resultados por periodo.</p></article>
        </div>
      </Reveal>
    </section>
  );
}

function ProductFeatures() {
  return (
    <section className="landing-section landing-features" id="producto" aria-labelledby="features-title">
      <div className="container">
        <Reveal className="landing-section-head">
          <span className="landing-kicker">Todo lo que necesitas</span>
          <h2 id="features-title">Herramientas pensadas para que tus clientes vuelvan.</h2>
          <p>Puntos, sellos, recompensas y cupones conectados con la operación diaria de tu negocio.</p>
        </Reveal>
        <Reveal className="landing-feature-grid" delay={0.05}>
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
        </Reveal>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="landing-section landing-how" id="como-funciona" aria-labelledby="how-title">
      <div className="container">
        <Reveal className="landing-section-head landing-section-head-light">
          <span className="landing-kicker landing-kicker-light">Cómo funciona</span>
          <h2 id="how-title">Configura, registra, recompensa y mide.</h2>
          <p>Un mismo flujo conecta la configuración del programa con el resultado en cada sucursal.</p>
        </Reveal>
        <Reveal className="landing-steps" delay={0.05}>
          {steps.map((step, index) => (
            <article key={step.title}>
              <div className="landing-step-top"><span><FontAwesomeIcon icon={step.icon} /></span><small>0{index + 1}</small></div>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </Reveal>
        <Reveal className="landing-customer-flow" delay={0.08}>
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
        </Reveal>
      </div>
    </section>
  );
}

function UseCases() {
  return (
    <section className="landing-section landing-cases" id="casos" aria-labelledby="cases-title">
      <div className="container">
        <Reveal className="landing-section-head landing-cases-head">
          <span className="landing-kicker">Para tu tipo de negocio</span>
          <h2 id="cases-title">La misma base, adaptada a tu forma de recibir clientes.</h2>
          <p>Cada negocio construye su propio programa según la frecuencia de visita y el beneficio que quiere ofrecer.</p>
        </Reveal>
        <Reveal className="landing-case-grid" delay={0.05}>
          {cases.map((item) => (
            <article key={item.title}>
              <span><FontAwesomeIcon icon={item.icon} /></span>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
              <small>{item.example}</small>
            </article>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="landing-section landing-faq" id="preguntas" aria-labelledby="faq-title">
      <Reveal className="container landing-faq-layout">
        <div className="landing-section-head landing-faq-head">
          <span className="landing-kicker">Preguntas frecuentes</span>
          <h2 id="faq-title">Lo que necesitas saber antes de empezar.</h2>
          <p>Respuestas claras sobre el programa, los planes y la operación diaria.</p>
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
      </Reveal>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="landing-final-cta" aria-labelledby="final-cta-title">
      <Reveal className="container landing-final-cta-inner">
        <div>
          <span className="landing-kicker landing-kicker-light">Tu primer programa empieza gratis</span>
          <h2 id="final-cta-title">Haz que cada visita cuente.</h2>
          <p>Crea tu cuenta, configura tu negocio y empieza a fidelizar clientes hoy.</p>
        </div>
        <div className="landing-actions">
          <Link className="landing-button landing-button-mint" to="/registro">Crear mi cuenta</Link>
          <Link className="landing-text-link landing-text-link-light" to="/login">Ya tengo una cuenta</Link>
        </div>
      </Reveal>
    </section>
  );
}

export default function HomePage() {
  useEffect(() => {
    const previousTitle = document.title;
    const title = 'Benefy | Puntos, sellos y cupones para tu negocio';
    const description = 'Benefy ayuda a cafeterías, barberías, gimnasios y comercios a fidelizar clientes con puntos, tarjetas de sellos, recompensas y cupones.';
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
    <LandingMotionProvider>
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
    </LandingMotionProvider>
  );
}
