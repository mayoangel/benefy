import Icon from '../components/Icon.tsx';
import logo from '../assets/LogoR.png';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRightLong,faUserCheck,faUserLock,faCheck,faQrcode,faMugHot,faHandshake, IconDefinition,
  faStamp,faRankingStar,faTicket, faDumbbell,faStore, faUtensils,
  faListCheck, faSquarePlus, faCircleCheck, faMobileScreenButton, faShieldHalved,
  faNetworkWired
} from "@fortawesome/free-solid-svg-icons";


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
      label: 'Ticket medio con puntos',
      value: '+28%',
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
    title: 'Red de Alianzas Cruzadas (Zero-Knowledge)',
    copy: 'Conecta tu comercio con negocios complementarios de tu barrio o polígono sin ceder tus datos ni clientes. Por ejemplo: tu cafetería premia a socios del gimnasio vecino y viceversa. Ambas partes ganan tráfico calificado con privacidad 100% garantizada',
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
    copy: 'Sellos automáticos de cafés diarios, upgrades de bollería en horas valle y promociones combo matutinas.',
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
    copy: 'Boutiques, librerías, peluquerías y spas. Premia compras repetidas y activa ventas cruzadas comunitarias.',
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
    copy: 'Registra cada visita con QR desde tu móvil.',
  },
  {
    icon: faHandshake,
    title: 'Mide y conecta',
    copy: 'Revisa tus resultados y crea alianzas locales.',
  },
];

function HomeHero() {
  return (
    <section className="home-hero">
      <div className="container home-hero-grid">
        <div>
          <div className="eyebrow">
            <i />
            Fidelización local, hecha simple
          </div>
          <h1>
            Convierte visitas ocasionales en{' '}
            <em>relaciones duraderas</em> y alianzas estratégicas.
          </h1>
          <p>
            La plataforma de beneficios que ayuda a los comercios a premiar la
            lealtad y crecer en comunidad, sin fricción tecnológica.
          </p>
          <div className="home-actions">
            <Link className="button button-small" to="/precios">
              Comenzar gratis <FontAwesomeIcon icon={faRightLong} />
            </Link>
            <Link className="button home-outline" to="/about">
              Conoce Benefy
            </Link>
          </div>
          <div className="home-trust">
            <span>
              <FontAwesomeIcon icon={faUserCheck} />
              Sin comisiones por canje
            </span>
            <span>
              <FontAwesomeIcon icon={faUserLock} />
              Privacidad protegida
            </span>
          </div>
        </div>

        <div className="home-visual">
          <div className="home-orbit" />
          <div className="home-card">
            <div className="home-card-top">
              <span className="brand-mark small">
                <img className="brand-mark-image" src={logo} alt="" />
              </span>
              <b>Benefy</b>
              <span className="home-card-status">
                <small>BENEFICIO ACTIVO</small>
                <span className="home-card-partner">
                  <FontAwesomeIcon icon={faMugHot} />
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
              <i />
              <b>
                <FontAwesomeIcon icon={faCheck} />
              </b>
            </div>
            <small>4 de 5 visitas completadas </small>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="home-section home-features-section container">
              <div className="home-section-heading center">
                <span className="features-badge">Diseñado para comercios modernos</span>
                <h2>Todo lo que necesitas para fidelizar sin fricción tecnológica</h2>
                <p>
                  Elimina las tarjetas de papel olvidadas y los caros lectores de TPV.
                  Benefy funciona directamente desde el smartphone de tus clientes y
                  la tablet o móvil de tu mostrador.
                </p>
              </div>
            <div className="home-feature-grid">
              {features.map((feature, index) => (
                <article
                  className={`home-feature home-feature-${index + 1}`}
                  key={feature.title}
                >
                  <span>
                    <FontAwesomeIcon icon={feature.icon} />
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
                          <FontAwesomeIcon icon={benefit.icon} />
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
                        <FontAwesomeIcon icon={feature.detail.icon} />
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
    <section className="home-sectors">
      <div className="container sectors-layout">
        <div>
          <div className="kicker">
            <span>02</span>
            PARA CADA COMUNIDAD
          </div>
          <h2>
            Diseñado a la medida de tu <em>sector comercial.</em>
          </h2>
          <p>
            Una experiencia flexible que se adapta a cómo tus clientes viven
            cada visita.
          </p>
          <Link className="sector-link" to="/precios">
            Encuentra tu plan <FontAwesomeIcon icon={faRightLong} />
          </Link>
        </div>
        <div className="sector-grid">
          {sectors.map((sector, index) => (
            <div
              className={`sector-card sector-${index + 1}`}
              key={sector.title}
            >
              <span>
                <FontAwesomeIcon icon={sector.icon} />
              </span>
              <b>{sector.title}</b>
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
    <section className="home-section container">
      <div className="home-section-heading center">
        <div className="kicker">
          <span>03</span>
          FÁCIL EN TU MOSTRADOR
        </div>
        <h2>¿Cómo funciona Benefy?</h2>
        <p>
          De la primera visita a una comunidad que regresa, en unos pocos pasos.
        </p>
      </div>
      <div className="how-grid">
        {steps.map((step, index) => (
          <article className="how-step" key={step.title}>
            <span className="how-icon">
              <FontAwesomeIcon icon={step.icon} />
            </span>
            <small>PASO 0{index + 1}</small>
            <h3>{step.title}</h3>
            <p>{step.copy}</p>
            {index < steps.length - 1 && (
              <span className="how-arrow">
                <FontAwesomeIcon icon={faRightLong} />
              </span>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function HomeCTA() {
  return (
    <section className="container home-cta">
      <div>
        <span className="cta-kicker">
          <i />
          CRECE EN COMUNIDAD
        </span>
        <h2>
          Transforma cada visita en fidelidad y{' '}
          <em>mayores ingresos.</em>
        </h2>
        <p>
          Conecta con tus clientes y con los comercios que dan vida a tu barrio.
        </p>
      </div>
      <Link className="button button-light" to="/precios">
        Ver planes Benefy <FontAwesomeIcon icon={faRightLong} />
      </Link>
    </section>
  );
}

export default function HomePage() {
  return (
    <main className="home-page">
      <HomeHero />
      <Features />
      <Sectors />
      <HowItWorks />
      <HomeCTA />
    </main>
  );
}
