import { useEffect, useState } from 'react';
import Icon from '../components/Icon.tsx';
import logo from '../assets/LogoR.png';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRightLong,faUserCheck,faUserLock,faCheck,faQrcode,faMugHot,faHandshake, IconDefinition,
  faStamp,faRankingStar,faTicket, faDumbbell,faStore, faUtensils,
  faListCheck, faSquarePlus, faCircleCheck, faMobileScreenButton, faShieldHalved,
  faNetworkWired
} from "@fortawesome/free-solid-svg-icons";
import useReveal from '../hooks/useReveal.ts';


type Feature = {
  icon: IconDefinition;
  title: string;
  copy: string;
  detail: {
    icon?: IconDefinition;
    label: string;
    copy?: string;
    value?: string;
    progress?: boolean;
  };
  benefits?: {
    icon: IconDefinition;
    label: string;
  }[];
  exclusive?: boolean;
};

type Sector = {
  icon: IconDefinition;
  title: string;
  copy: string;
  example: string;
};

type Step = {
  icon: IconDefinition;
  title: string;
  copy: string;
};

const faqs: [string, string][] = [
  [
    '¿Mis clientes tienen que descargar una app?',
    'No. Pueden usar su celular con un toque NFC o escaneando un código QR, sin descargas obligatorias.',
  ],
  [
    '¿Qué pasa con los datos de mis clientes?',
    'No los vendemos ni los compartimos con otros comercios. Benefy valida el beneficio sin necesitar saber quién es la persona.',
  ],
  [
    '¿Cuánto tarda empezar?',
    'Puedes crear tu programa y colocar tu QR el mismo día; no necesitas instalar equipo adicional.',
  ],
  [
    '¿Puedo aliarme con negocios de mi zona?',
    'Sí. La red de alianzas cruzadas conecta comercios vecinos y la compensación entre ellos se liquida de forma automática.',
  ],
  [
    '¿Puedo cancelar cuando quiera?',
    'Sí, sin costo de instalación y sin permanencia mínima.',
  ],
];

const features: Feature[] = [
  {
    icon: faStamp,
    title: 'Tarjetas de sellos digitales dinámicas',
    copy: 'Crea programas de sellos atractivos que viven directamente en Apple Wallet o Google Wallet. Configura reglas automáticas de progreso, sellos dobles en días de baja demanda y notificaciones geolocalizadas al pasar cerca de tu tienda.',
    detail: {
      icon: faMobileScreenButton,
      label: 'Compatibilidad Universal',
      copy: 'Sin necesidad de descargar apps pesadas obligatorias',
      value: '1-Tap Add',
    },
  },
  {
    icon: faRankingStar,
    title: 'Acumulación de puntos inteligente',
    copy: 'Premia el ticket de compra o la frecuencia. Establece niveles (Plata, Oro, VIP) que desbloquean beneficios exclusivos conforme tus clientes aumentan su valor en el tiempo.',
    detail: {
      label: 'Retención mediana de clientes',
      value: '68%',
      progress: true,
    },
  },
  {
    icon: faTicket,
    title: 'Cupones temporales automatizados',
    copy: 'Genera incentivos automáticos: regalos de cumpleaños, cupones "Te echamos de menos" tras 30 días sin visitas, y promociones flash para llenar horarios valle.',
    detail: {
      icon: faListCheck,
      label: 'Automatizaciones programadas listas en 1 clic',
    },
  },
  {
    icon: faHandshake,
    title: 'Red de alianzas cruzadas',
    copy: 'Conecta tu comercio con negocios complementarios de tu barrio o zona sin ceder tus datos ni clientes. No compartimos ni vendemos los datos de tus clientes; solo validamos el beneficio.',
    detail: {
      label: 'Bases de datos no compartidas',
    },
    benefits: [
      { icon: faShieldHalved, label: 'Bases de datos no compartidas' },
      { icon: faNetworkWired, label: 'Compensación mutua transparente' },
    ],
    exclusive: true,
  },
];

const sectors: Sector[] = [
  {
    icon: faMugHot,
    title: 'Cafeterías & Bistrós',
    copy: 'Sellos automáticos de cafés diarios, upgrades de panadería en horas valle y promociones combo matutinas.',
    example: 'Tarjeta 10 sellos con café de especialidad de regalo.',
  },
  {
    icon: faDumbbell,
    title: 'Gimnasios & Fitness',
    copy: 'Incentiva la constancia de asistencia semanal, entrenamientos personales y bonos de nutrición deportiva.',
    example: 'Sellos por asistencia consecutiva canjeables por sesiones pro.',
  },
  {
    icon: faUtensils,
    title: 'Restaurantes',
    copy: 'Fideliza a clientes de menú diario corporativo y premia mesas de fin de semana con postres o maridajes cortesía.',
    example: 'Puntos acumulables en cuenta final para descuento en cenas.',
  },
  {
    icon: faStore,
    title: 'Retail & Especialidad',
    copy: 'Boutiques, librerías, barberías y estéticas. Premia compras repetidas y activa ventas cruzadas comunitarias.',
    example: 'Cupones de cumpleaños automáticos y acceso a preventas.',
  },
];

const steps: Step[] = [
  {
    icon: faSquarePlus,
    title: 'Crea tu programa',
    copy: 'Elige sellos, puntos o beneficios para tu comunidad.',
  },
  {
    icon: faQrcode,
    title: 'Coloca tu QR',
    copy: 'Ponlo en la barra, mesa o mostrador.',
  },
  {
    icon: faCircleCheck,
    title: 'Valida en segundos',
    copy: 'Valida cada visita con NFC o QR dinámico desde la terminal o el celular.',
  },
  {
    icon: faHandshake,
    title: 'Mide y conecta',
    copy: 'Revisa tus resultados y crea alianzas locales.',
  },
];

function HomeHero() {
  return (
    <section className="home-hero" aria-labelledby="home-hero-title">
      <div className="container home-hero-grid">
        <div>
          <div className="eyebrow">
            <i />
            Fidelización local, hecha simple
          </div>
          <h1 id="home-hero-title">
            Convierte visitas ocasionales en{' '}
            <em>relaciones duraderas</em> y alianzas estratégicas.
          </h1>
          <p>
            La plataforma de beneficios que ayuda a los comercios a premiar la
            lealtad y crecer en comunidad, sin fricción tecnológica.
          </p>
          <div className="home-actions">
            <Link className="button button-small" to="/precios">
              Comenzar gratis <FontAwesomeIcon icon={faRightLong} aria-hidden="true" />
            </Link>
            <Link className="button home-outline" to="/about">
              Conoce Benefy
            </Link>
          </div>
          <div className="home-trust">
            <span>
              <FontAwesomeIcon icon={faUserCheck} aria-hidden="true" />
              Sin comisiones por canje
            </span>
            <span>
              <FontAwesomeIcon icon={faUserLock} aria-hidden="true" />
              Privacidad protegida
            </span>
          </div>
        </div>

        <div className="home-visual">
          <div className="home-orbit" />
          <div className="home-card">
            <div className="home-card-top">
              <span className="brand-mark small">
                <img className="brand-mark-image" src={logo} alt="" width="500" height="331" />
              </span>
              <b>Benefy</b>
              <span className="home-card-status">
                <small>BENEFICIO ACTIVO</small>
                <span className="home-card-partner">
                  <FontAwesomeIcon icon={faMugHot} aria-hidden="true" />
                  Café Blend
                </span>
              </span>
            </div>
            <span className="home-card-label">TU PRÓXIMA RECOMPENSA</span>
            <strong>
              Un café
              <br />
              va por <em>nosotros.</em>
            </strong>
            <div className="home-progress">
              <i />
              <i />
              <i />
              <i />
              <b>
                <FontAwesomeIcon icon={faCheck} aria-hidden="true" />
              </b>
            </div>
            <small>4 de 5 visitas completadas</small>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="home-section home-features-section container" aria-labelledby="home-features-title">
              <div className="home-section-heading center">
                <span className="features-badge">Diseñado para comercios modernos</span>
                <h2 id="home-features-title">Todo lo que necesitas para fidelizar sin fricción tecnológica</h2>
                <p>
                  Elimina las tarjetas de papel olvidadas y los caros lectores
                  adicionales. Benefy valida cada beneficio con NFC o QR dinámico
                  desde la terminal o el celular.
                </p>
              </div>
            <div className="home-feature-grid">
              {features.map((feature, index) => (
                <article
                  className={`home-feature home-feature-${index + 1}`}
                  key={feature.title}
                >
                  <span>
                    <FontAwesomeIcon icon={feature.icon} aria-hidden="true" />
                  </span>
                  <h3>
                    {feature.title}
                    {feature.exclusive && (
                      <small className="home-feature-exclusive">Exclusivo</small>
                    )}
                  </h3>
                  <p>{feature.copy}</p>
                  {feature.benefits ? (
                    <div className="feature-detail feature-alliance">
                      {feature.benefits.map((benefit) => (
                        <span key={benefit.label}>
                          <FontAwesomeIcon icon={benefit.icon} aria-hidden="true" />
                          {benefit.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div
                      className={`feature-detail${
                        feature.detail.progress ? ' feature-points' : ''
                      }`}
                    >
                      {feature.detail.icon && (
                        <FontAwesomeIcon icon={feature.detail.icon} aria-hidden="true" />
                      )}
                      <span>
                        <b>{feature.detail.label}</b>
                        {feature.detail.copy && <small>{feature.detail.copy}</small>}
                      </span>
                      {feature.detail.progress ? (
                        <>
                          {feature.detail.value && (
                            <strong>{feature.detail.value}</strong>
                          )}
                          <i>
                            <span />
                          </i>
                        </>
                      ) : (
                        feature.detail.value && (
                          <strong>{feature.detail.value}</strong>
                        )
                      )}
                    </div>
                  )}
                </article>
        ))}
      </div>
    </section>
  );
}

function Sectors() {
  return (
    <section className="home-sectors" aria-labelledby="home-sectors-title">
      <div className="container sectors-layout">
        <div>
          <div className="kicker">
            PARA CADA COMUNIDAD
          </div>
          <h2 id="home-sectors-title">
            Diseñado a la medida de tu <em>sector comercial.</em>
          </h2>
          <p>
            Una experiencia flexible que se adapta a cómo tus clientes viven
            cada visita.
          </p>
          <Link className="sector-link" to="/precios">
            Encuentra tu plan <FontAwesomeIcon icon={faRightLong} aria-hidden="true" />
          </Link>
        </div>
        <div className="sector-grid">
          {sectors.map((sector, index) => (
            <div
              className={`sector-card sector-${index + 1}`}
              key={sector.title}
            >
              <span>
                <FontAwesomeIcon icon={sector.icon} aria-hidden="true" />
              </span>
              <h3>{sector.title}</h3>
              <p>{sector.copy}</p>
              <small>
                <strong>Caso habitual:</strong>
                {sector.example}
              </small>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="home-section container" aria-labelledby="home-how-title">
      <div className="home-section-heading center">
        <div className="kicker">
          FÁCIL EN TU MOSTRADOR
        </div>
        <h2 id="home-how-title">¿Cómo funciona Benefy?</h2>
        <p>
          De la primera visita a una comunidad que regresa, en unos pocos pasos.
        </p>
      </div>
      <div className="how-grid">
        {steps.map((step, index) => (
          <article className="how-step" key={step.title}>
            <span className="how-icon">
              <FontAwesomeIcon icon={step.icon} aria-hidden="true" />
            </span>
            <small>PASO 0{index + 1}</small>
            <h3>{step.title}</h3>
            <p>{step.copy}</p>
            {index < steps.length - 1 && (
              <span className="how-arrow">
                <FontAwesomeIcon icon={faRightLong} aria-hidden="true" />
              </span>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="faq-section home-faq container" aria-labelledby="home-faq-title">
      <div className="faq-heading">
        <span className="kicker">PREGUNTAS FRECUENTES</span>
        <h2 id="home-faq-title">Lo que todos nos preguntan antes de empezar</h2>
      </div>
      <div className="faq-list">
        {faqs.map(([question, answer], index) => {
          const panelId = `home-faq-answer-${index}`;
          const isOpen = open === index;

          return (
            <article className={`faq-item${isOpen ? ' faq-open' : ''}`} key={question}>
              <button
                aria-controls={panelId}
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : index)}
              >
                <span>{question}</span>
                <Icon name={isOpen ? 'expand_less' : 'expand_more'} />
              </button>
              {isOpen && <p id={panelId}>{answer}</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function HomeCTA() {
  return (
    <section className="container home-cta" aria-labelledby="home-cta-title">
      <div>
        <span className="cta-kicker">
          <i />
          CRECE EN COMUNIDAD
        </span>
        <h2 id="home-cta-title">
          Transforma cada visita en fidelidad y{' '}
          <em>mayores ingresos.</em>
        </h2>
        <p>
          Conecta con tus clientes y con los comercios que dan vida a tu barrio.
        </p>
      </div>
      <div className="home-cta-actions">
        <Link className="button button-light" to="/precios">
          Ver planes Benefy <FontAwesomeIcon icon={faRightLong} aria-hidden="true" />
        </Link>
        <Link className="cta-secondary" to="/about">
          Hablar con el equipo
        </Link>
      </div>
    </section>
  );
}

export default function HomePage() {
  useEffect(() => {
    const previousTitle = document.title;
    const description = 'Benefy ayuda a comercios locales a fidelizar clientes y crecer con alianzas inteligentes, usando beneficios con NFC y QR dinámico.';
    const title = 'Benefy | Fidelización local hecha simple';
    const managedMeta: HTMLMetaElement[] = [];

    document.title = title;

    const setMeta = (attribute: 'name' | 'property', key: string, content: string) => {
      let meta = document.head.querySelector<HTMLMetaElement>(
        `meta[${attribute}="${key}"]`,
      );
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

  useReveal(
    '.home-page > section:not(.home-hero), .how-step, .home-feature, .sector-card',
  );

  return (
    <main className="home-page">
      <HomeHero />
      <Features />
      <Sectors />
      <HowItWorks />
      <FAQ />
      <HomeCTA />
    </main>
  );
}
