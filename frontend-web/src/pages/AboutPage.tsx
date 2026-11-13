import { Link } from 'react-router-dom';
import Icon from '../components/Icon.tsx';
import type { IconName } from '../components/Icon.tsx';
import logo from '../assets/LogoR.png';
import useReveal from '../hooks/useReveal.ts';



type Metric = {
  label: string;
  value: string;
  note: string;
};

const metrics: Metric[] = [
  { label: 'Comercios activos', value: '1,400+', note: 'En 18 ciudades' },
  { label: 'Tickets canjeados', value: '3.2M', note: '+142% vs. 2024' },
  { label: 'Retención mediana', value: '68%', note: 'Clientes que regresan' },
  { label: 'Privacidad', value: '100%', note: 'Sin venta de datos' },
];

function BrandMark() {
  return (
    <span className="brand-mark">
      <img className="brand-mark-image" src={logo} alt="" width="500" height="331" />
    </span>
  );
}

function Hero() {
  return (
    <section className="hero container" id="inicio" aria-labelledby="hero-title">
      <div className="glow glow-mint" />
      <div className="glow glow-blue" />
      <div className="eyebrow">
        <i />
        Propósito &amp; visión corporativa
      </div>
      <h1 id="hero-title">
        Nuestra misión: redefinir la fidelización local a través de{' '}
        <em>alianzas inteligentes.</em>
      </h1>
      <p className="hero-lede">
        Empoderamos a comercios independientes y medianos con la infraestructura
        de fidelización que antes era exclusiva de las grandes corporaciones.
        Creamos ecosistemas colaborativos donde cada transacción fortalece al
        comercio local con tecnología ágil, accesible y sin fricción.
      </p>
      <div className="metrics">
        {metrics.map((metric) => (
          <article className="metric" key={metric.label}>
            <span>{metric.label}</span>
            <b>{metric.value}</b>
            <small>{metric.note}</small>
          </article>
        ))}
      </div>
      <a className="scroll-cue" href="#historia">
       
        Conoce nuestra historia
          <Icon name="arrowDown" />
      
      </a>
    </section>
  );
}

function Ticket() {
  return (
    <div className="ticket-scene">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />

      <article className="ticket">
        <div className="ticket-top">
          <span className="ticket-brand">
            <BrandMark />
            Benefy
          </span>
          <span className="ticket-status">
            <i />
            ACTIVO
          </span>
        </div>

        <div className="ticket-body">
          <small className="ticket-code-label">ALLIANCE TOKEN · #BFY-8941</small>
          <span className="ticket-kicker">BENEFICIO ALIADO</span>
          <b className="ticket-amount">
            15<small>%</small>
            <em>de descuento</em>
          </b>
          <p className="ticket-partners">
            <span>Café Blend</span>
            <i>×</i>
            <span>Trattoria Roma Norte</span>
          </p>

          <div className="ticket-stamps">
            <div className="stamps-label">
              <span>Tu progreso</span>
              <b>4 / 5 visitas</b>
            </div>
            <div className="stamps-row">
              <i className="on" />
              <i className="on" />
              <i className="on" />
              <i className="on" />
              <i className="gift">
                <Icon name="bolt" />
              </i>
            </div>
          </div>
        </div>

        <div className="ticket-cut">
          <i />
          <i />
        </div>

        <div className="ticket-foot">
          <span>
            <Icon name="verifiedUser" />
            Validado vía terminal POS
          </span>
          <span className="barcode" aria-hidden="true">
            ||| || |||| | ||| ||
          </span>
        </div>
      </article>

      <div className="float-card float-top">
        <span className="float-icon">
          <Icon name="bolt" />
        </span>
        <span className="float-copy">
          <b>Canje instantáneo</b>
          <small>Sin descargas obligatorias</small>
        </span>
      </div>

      <div
        className="float-card float-bottom"
        title="Validamos el beneficio sin guardar ni vender datos personales"
      >
        <span className="float-icon mint">
          <Icon name="lock" />
        </span>
        <span className="float-copy">
          <b>Zero-Knowledge</b>
          <small>Privacidad protegida</small>
        </span>
      </div>

      <div className="scene-caption">
        <span className="scene-icon">
          <Icon name="store" />
        </span>
        <span className="scene-copy">
          <b>Una red que multiplica</b>
          <small>Comercios conectados en vivo</small>
        </span>
        <i aria-hidden="true" />
      </div>
    </div>
  );
}

function Story() {
  return (
    <section className="story container" id="historia" aria-labelledby="story-title">
      <div className="story-copy">
        <div className="kicker">
          <span>01</span>
          EL ORIGEN DE BENEFY
        </div>
        <h2 id="story-title">
          De la tarjeta de cartón perdida al <em>pasaporte digital.</em>
        </h2>
        <p className="lead">
          Durante décadas, la fidelización estuvo atrapada entre tarjetas de
          cartón olvidadas y programas bancarios reservados para grandes
          corporaciones.
        </p>
        <p>
          Benefy nació para cerrar esa brecha. Creamos una plataforma donde una
          cafetería local, una librería independiente y un restaurante
          familiar pueden formar redes de incentivos cruzados y activar
          recompensas con NFC o códigos QR dinámicos.
        </p>
        <p>
          Todo parte de una premisa no negociable: los clientes reciben
          beneficios tangibles sin que su información personal se empaquete ni
          se venda.
        </p>
        <div className="privacy-note">
          <Icon name="lock" />
          <p>
            <strong>En palabras simples:</strong> no guardamos ni vendemos los
            datos personales de tus clientes. Benefy valida el beneficio sin
            necesitar saber quién es la persona.
          </p>
        </div>
        <div className="tags">
          <span>
            <Icon name="bolt" />
            NFC &amp; QR dinámico
          </span>
          <span>
            <Icon name="lock" />
            Privacidad criptográfica
          </span>
        </div>
      </div>
      <Ticket />
    </section>
  );
}

const values: {
  icon: IconName;
  tag: string;
  title: string;
  copy: string;
  detail: string;
}[] = [
  {
    icon: 'storefront',
    tag: 'Autonomía',
    title: 'Comercio local primero',
    copy: 'Ponemos tecnología de nivel empresarial y herramientas de retención al alcance de los negocios de barrio.',
    detail: 'ROI medible desde el día uno',
  },
  {
    icon: 'shield_lock',
    tag: 'Confianza',
    title: 'Privacidad inquebrantable',
    copy: 'Respetamos los datos de cada cliente. Sin rastreo invasivo de ubicación ni venta de perfiles.',
    detail: 'Cifrado de extremo a extremo',
  },
  {
    icon: 'handshake',
    tag: 'Sinergia',
    title: 'Crecimiento colaborativo',
    copy: 'Los comercios vecinos se recomiendan entre sí y multiplican su alcance sin depender de anuncios caros.',
    detail: 'Redes de múltiples comercios',
  },
  {
    icon: 'speed',
    tag: 'Eficiencia',
    title: 'Simplicidad operativa',
    copy: 'La validación es ágil para cajeros y meseros, incluso cuando el negocio está en hora pico.',
    detail: 'Menos de 2 s por validación',
  },
];

function Values() {
  return (
    <section className="band values" id="valores" aria-labelledby="values-title">
      <div className="container">
        <div className="center-heading">
          <div className="kicker">
            <span>02</span>
            LO QUE NOS GUÍA
          </div>
          <h2 id="values-title">
            Pilares <em>innegociables</em>
          </h2>
          <p>
            Construimos software pensado para las personas que están en la
            primera línea del servicio.
          </p>
        </div>
        <div className="value-grid">
          {values.map((value, index) => (
            <article className="value-card" key={value.title}>
              <div className="value-top">
                <span className="value-icon">
                  <Icon name={value.icon} />
                </span>
                <small>0{index + 1}</small>
              </div>
              <span className="value-tag">{value.tag}</span>
              <h3>{value.title}</h3>
              <p>{value.copy}</p>
              <div className="value-detail">
                <Icon name="arrowOutward" />
                {value.detail}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Dashboard() {
  const bars = [30, 55, 38, 70, 48, 85, 58, 76, 48, 95, 66, 80];
  const partners = [
    ['CB', 'Café Blend'],
    ['TR', 'Trattoria'],
    ['LL', 'Librería'],
  ];

  return (
    <div className="dashboard">
      <div className="dash-top">
        <span>
          <BrandMark />
          Benefy <small>BUSINESS</small>
        </span>
        <div className="dash-user">
          <i>CB</i>
          <span>
            <b>Café Blend</b>
            <small>Plan crecimiento</small>
          </span>
          <Icon name="arrowOutward" />
        </div>
      </div>
      <div className="dash-layout">
        <aside className="dash-side">
          <Icon name="store" />
          <Icon name="handshake" />
          <Icon name="confirmation_number" />
          <Icon name="bar_chart" />
          <Icon name="settings" />
        </aside>
        <div className="dash-main">
          <div className="dash-heading">
            <span>
              <small>MIÉRCOLES, 26 DE OCTUBRE</small>
              <b>
                Buenos días, Café Blend <em>☀</em>
              </b>
            </span>
            <small className="live">
              <i />
              Datos en vivo
            </small>
          </div>
          <div className="dash-stats">
            <div>
              <small>Clientes recurrentes</small>
              <b>
                684 <i>+12.8%</i>
              </b>
              <div className="sparkline" />
            </div>
            <div>
              <small>Recompensas canjeadas</small>
              <b>
                1,248 <i>+8.4%</i>
              </b>
              <div className="bars">
                {bars.map((height, index) => (
                  <i key={index} style={{ height: `${height}%` }} />
                ))}
              </div>
            </div>
          </div>
          <div className="dash-chart">
            <span>Actividad de la comunidad</span>
            <div className="chart">
              <i />
              <i />
              <i />
              <i />
              <i />
              <svg viewBox="0 0 300 70" preserveAspectRatio="none" aria-hidden="true">
                <path d="M0 58 C18 55 24 36 44 43 S72 49 88 33 115 41 132 28 156 40 175 21 204 35 221 15 246 26 263 12 283 19 300 4" />
              </svg>
            </div>
          </div>
          <div className="dash-partners">
            {partners.map(([initials, name]) => (
              <span key={initials}>
                <i>{initials}</i>
                {name}
              </span>
            ))}
            <b>+8 aliados</b>
          </div>
        </div>
      </div>
    </div>
  );
}

function Phone() {
  const partners = [
    ['CB', 'Café Blend'],
    ['TR', 'Trattoria'],
    ['LL', 'Librería'],
  ];

  return (
    <div className="phone-stage">
      <div className="phone-glow" />
      <div className="phone">
        <div className="notch" />
        <div className="phone-screen">
          <div className="phone-status">
            9:41 <span>●●● ◉</span>
          </div>
          <div className="phone-brand">
            <BrandMark />
            Benefy
            <Icon name="notifications" />
          </div>
          <small className="phone-muted">Tu comunidad</small>
          <h4>
            Hola, Alex <em>✦</em>
          </h4>
          <div className="reward">
            <small>BENEFICIO DE HOY</small>
            <b>
              Un café
              <br />
              por cuenta de <em>la casa.</em>
            </b>
            <span className="coffee">
              <Icon name="local_cafe" />
            </span>
            <div>
              En Café Blend <b>Canjear&nbsp; →</b>
            </div>
          </div>
          <div className="partners-title">
            Tus aliados <span>Ver todos</span>
          </div>
          <div className="phone-partners">
            {partners.map(([initials, name]) => (
              <span key={initials}>
                <i>{initials}</i>
                {name}
              </span>
            ))}
          </div>
          <div className="phone-nav">
            <Icon name="home" />
            <Icon name="qr_code_scanner" />
            <Icon name="person" />
          </div>
        </div>
      </div>
    </div>
  );
}

const steps = [
  {
    number: '01',
    title: 'Consumo en el comercio',
    copy: 'El cliente disfruta su visita y pide su cuenta normal.',
  },
  {
    number: '02',
    title: 'Tap NFC o escaneo QR',
    copy: 'Validación instantánea en la terminal o el móvil.',
  },
  {
    number: '03',
    title: 'Compensación automática',
    copy: 'El libro contable B2B liquida entre comercios aliados.',
  },
];

function Platform() {
  return (
    <section className="platform container" id="plataforma" aria-labelledby="platform-title">
      <div className="platform-intro">
        <div className="kicker">
          <span>03</span>
          UNA EXPERIENCIA, DOS PERSPECTIVAS
        </div>
        <h2 id="platform-title">
          Arquitectura dual,
          <br />
          <em>simple por diseño.</em>
        </h2>
        <p>
          La fidelización fracasa cuando el sistema es lento o complicado.
          Benefy separa la gestión del negocio de la experiencia del cliente para
          que ambas funcionen sin fricción.
        </p>
      </div>
      <div className="platform-grid">
        <article className="platform-card">
          <div className="platform-copy">
            <span className="platform-icon">
              <Icon name="desktop_windows" />
            </span>
            <div>
              <h3>Web ligera para gerentes</h3>
              <p>
                Configura campañas, crea alianzas y mide la retención sin
                instalar software adicional.
              </p>
            </div>
          </div>
          <div className="dashboard-window">
            <Dashboard />
          </div>
          <div className="platform-foot">
            <Icon name="monitoring" />
            Panel analítico en tiempo real
          </div>
        </article>
        <article className="platform-card mobile-card">
          <div className="platform-copy">
            <span className="platform-icon">
              <Icon name="smartphone" />
            </span>
            <div>
              <h3>Ágil para cada cliente</h3>
              <p>
                Un toque NFC o QR para consultar y canjear beneficios, sin
                formularios tediosos al pagar.
              </p>
            </div>
          </div>
          <Phone />
          <div className="platform-foot">
            <Icon name="touch_app" />
            Wallet digital lista para usar
          </div>
        </article>
      </div>
      <div className="flow">
        <div className="flow-title">
          <span className="flow-symbol">
            <Icon name="sync_alt" />
          </span>
          <span>
            <b>Así de fácil</b>
            <small>Un flujo de canje instantáneo</small>
          </span>
          <strong>
            <Icon name="bolt" />
            Sync &lt; 300 ms
          </strong>
        </div>
        <div className="flow-steps">
          {steps.map((step) => (
            <div className="flow-step" key={step.number}>
              <i>{step.number}</i>
              <span>
                <b>{step.title}</b>
                <small>{step.copy}</small>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="container cta" id="contacto" aria-labelledby="cta-title">
      <div className="cta-card">
        <div className="cta-decor decor-one" />
        <div className="cta-decor decor-two" />
        <div className="cta-content">
          <div className="cta-kicker">
            <i />
            TU PRÓXIMA ALIANZA EMPIEZA AQUÍ
          </div>
          <h2 id="cta-title">
            ¿Listo para crecer
            <br />
            en <em>comunidad?</em>
          </h2>
          <p>
            Súmate a más de 1,400 establecimientos que convirtieron clientes
            esporádicos en promotores de su negocio.
          </p>
          <div className="cta-actions">
            <Link className="button button-light" to="/precios">
              Comenzar gratis <Icon name="arrowForward" />
            </Link>
            <a className="cta-secondary" href="#footer">
              Contactar al equipo
            </a>
          </div>
          <small className="cta-note">
            <Icon name="lock" />
            Sin costo de instalación · Cancela cuando quieras
          </small>
        </div>
        <div className="network-art">
          <div className="ring outer" />
          <div className="ring inner" />
          <span className="star star-one">✦</span>
          <span className="star star-two">✦</span>
          <div className="network-logo">
            <BrandMark />
            Benefy
          </div>
          <i className="node node-one">
            <Icon name="local_cafe" />
          </i>
          <i className="node node-two">
            <Icon name="menu_book" />
          </i>
          <i className="node node-three">
            <Icon name="restaurant" />
          </i>
        </div>
      </div>
    </section>
  );
}

export default function AboutPage() {
  useReveal(
    '.about-page > section, .value-card, .how-step',
  );

  return (
    <main className="about-page">
      <Hero />
      <Story />
      <Values />
      <Platform />
      <CTA />
    </main>
  );
}
