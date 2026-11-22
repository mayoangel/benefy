import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBuilding,
  faChartColumn,
  faCheck,
  faCircleUser,
  faGift,
  faLocationDot,
  faShieldHalved,
  faStamp,
  faStore,
  faTicket,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';

import { LandingMotionProvider, Reveal } from '../components/LandingMotion.tsx';
import couponsAsset from '../assets/coupons.png';
import logoMark from '../assets/logo_no_name.png';
import pointsAsset from '../assets/points.png';

const principles = [
  {
    icon: faStore,
    title: 'Operación antes que promesas',
    copy: 'Cada función debe ser utilizable en mostrador y conservar el contexto del negocio donde ocurrió.',
  },
  {
    icon: faLocationDot,
    title: 'Alcance por sucursal',
    copy: 'Visitas, canjes y equipo se organizan con permisos y datos vinculados a cada ubicación.',
  },
  {
    icon: faShieldHalved,
    title: 'Reglas visibles y auditables',
    copy: 'Puntos, vigencias, stock, cambios de plan y ajustes mantienen reglas explícitas en el sistema.',
  },
];

const roles = [
  ['Dueño', 'Administra el negocio completo, programas, recompensas, equipo y sucursales.'],
  ['Supervisor', 'Consulta y opera la actividad de la sucursal a la que fue asignado.'],
  ['Empleado', 'Registra visitas y valida canjes dentro del alcance de su sucursal.'],
  ['Cliente', 'Acumula progreso, obtiene cupones y conserva saldo e historial.'],
];

function AboutHero() {
  return (
    <section className="about-real-hero" aria-labelledby="about-real-title">
      <div className="container about-real-hero-grid">
        <Reveal className="about-real-hero-copy" mode="load">
          <span className="landing-kicker landing-kicker-light">Qué es Benefy</span>
          <h1 id="about-real-title">Lealtad diseñada para funcionar en la operación diaria.</h1>
          <p>
            Benefy conecta la configuración del programa, la actividad de cada
            sucursal y la experiencia del cliente en un mismo sistema de puntos,
            sellos, recompensas, cupones y canjes.
          </p>
          <div className="landing-actions">
            <Link className="landing-button landing-button-mint" to="/#producto">Conocer el producto</Link>
            <Link className="landing-text-link" to="/#como-funciona">Ver el flujo completo</Link>
          </div>
        </Reveal>

        <Reveal className="about-real-visual" mode="load" delay={0.12}>
          <div className="about-real-visual-head">
            <span><img src={logoMark} alt="" width="488" height="319" decoding="async" /> Benefy</span>
            <small>Un sistema · dos experiencias</small>
          </div>
          <div className="about-real-visual-grid">
            <article className="about-real-visual-main">
              <span>Portal para negocios</span>
              <strong>Configura, opera y revisa actividad.</strong>
              <div>
                <small><FontAwesomeIcon icon={faBuilding} /> Sucursales</small>
                <small><FontAwesomeIcon icon={faUsers} /> Equipo</small>
                <small><FontAwesomeIcon icon={faChartColumn} /> Métricas</small>
              </div>
            </article>
            <article>
              <img src={pointsAsset} alt="" width="2048" height="2048" decoding="async" />
              <span>Puntos</span>
              <strong>Saldo y vigencia</strong>
            </article>
            <article>
              <span className="about-real-stamp"><FontAwesomeIcon icon={faStamp} /></span>
              <span>Sellos</span>
              <strong>Meta y recompensa</strong>
            </article>
            <article>
              <img src={couponsAsset} alt="" width="2048" height="2048" decoding="async" />
              <span>Cupones</span>
              <strong>Emisión y canje</strong>
            </article>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function WhyBenefy() {
  return (
    <section className="landing-section about-real-why" aria-labelledby="about-why-title">
      <div className="container about-real-why-grid">
        <Reveal className="landing-section-head">
          <span className="landing-kicker">El problema que resolvemos</span>
          <h2 id="about-why-title">Un programa de lealtad también es una operación.</h2>
          <p>
            No basta con mostrar una recompensa. El negocio necesita reglas,
            permisos, vigencias y un registro confiable desde la visita hasta el canje.
          </p>
        </Reveal>
        <Reveal className="about-real-principles" delay={0.05}>
          {principles.map((principle) => (
            <article key={principle.title}>
              <span><FontAwesomeIcon icon={principle.icon} /></span>
              <div><h3>{principle.title}</h3><p>{principle.copy}</p></div>
            </article>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

function TwoExperiences() {
  return (
    <section className="landing-section about-real-experiences" aria-labelledby="about-experiences-title">
      <div className="container">
        <Reveal className="landing-section-head landing-section-head-light">
          <span className="landing-kicker landing-kicker-light">Producto conectado</span>
          <h2 id="about-experiences-title">Una base de datos, dos experiencias con responsabilidades distintas.</h2>
          <p>El negocio administra y valida; el cliente acumula, consulta y utiliza sus beneficios.</p>
        </Reveal>
        <div className="about-real-experience-grid">
          <Reveal className="about-real-experience-card">
            <span className="about-real-experience-icon"><FontAwesomeIcon icon={faStore} /></span>
            <small>Portal para negocios</small>
            <h3>Control operativo y comercial</h3>
            <ul>
              <li><FontAwesomeIcon icon={faCheck} /> Programas de puntos y tarjetas de sellos</li>
              <li><FontAwesomeIcon icon={faCheck} /> Recompensas, cupones y canjes</li>
              <li><FontAwesomeIcon icon={faCheck} /> Sucursales, invitaciones y roles</li>
              <li><FontAwesomeIcon icon={faCheck} /> Clientes y métricas por periodo</li>
            </ul>
          </Reveal>
          <Reveal className="about-real-experience-card" delay={0.08}>
            <span className="about-real-experience-icon"><FontAwesomeIcon icon={faCircleUser} /></span>
            <small>Experiencia del cliente</small>
            <h3>Progreso y beneficios personales</h3>
            <ul>
              <li><FontAwesomeIcon icon={faCheck} /> Registro de visitas con QR del negocio o sucursal</li>
              <li><FontAwesomeIcon icon={faCheck} /> Saldo de puntos y progreso de tarjetas</li>
              <li><FontAwesomeIcon icon={faCheck} /> Catálogo y adquisición de recompensas</li>
              <li><FontAwesomeIcon icon={faCheck} /> Billetera, historial e inicio del canje</li>
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Roles() {
  return (
    <section className="landing-section about-real-roles" aria-labelledby="about-roles-title">
      <div className="container about-real-roles-grid">
        <Reveal className="landing-section-head">
          <span className="landing-kicker">Personas y permisos</span>
          <h2 id="about-roles-title">Cada rol ve y opera lo que le corresponde.</h2>
          <p>Los permisos del portal se separan del plan comercial y respetan el alcance de negocio o sucursal.</p>
        </Reveal>
        <Reveal className="about-real-role-list" delay={0.05}>
          {roles.map(([name, copy], index) => (
            <article key={name}>
              <span>0{index + 1}</span>
              <div><h3>{name}</h3><p>{copy}</p></div>
            </article>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

function Transparency() {
  return (
    <section className="about-real-transparency" aria-labelledby="about-transparency-title">
      <Reveal className="container about-real-transparency-inner">
        <div>
          <span className="landing-kicker">Construcción responsable</span>
          <h2 id="about-transparency-title">La landing distingue lo disponible de lo que sigue en desarrollo.</h2>
        </div>
        <div>
          <p>
            Facturación con Stripe, analítica avanzada, exportación de reportes,
            personalización avanzada y alianzas comerciales no se presentan como
            capacidades actuales.
          </p>
          <p>
            Premium amplía hoy la capacidad de sucursales, tarjetas, recompensas y equipo.
          </p>
        </div>
      </Reveal>
    </section>
  );
}

function AboutCTA() {
  return (
    <section className="landing-final-cta" aria-labelledby="about-cta-title">
      <Reveal className="container landing-final-cta-inner">
        <div>
          <span className="landing-kicker landing-kicker-light">Empieza con una base real</span>
          <h2 id="about-cta-title">Crea el programa que tu equipo puede operar hoy.</h2>
          <p>El plan Free se asigna automáticamente al registrar un negocio.</p>
        </div>
        <div className="landing-actions">
          <Link className="landing-button landing-button-mint" to="/registro">Crear mi negocio</Link>
          <Link className="landing-text-link landing-text-link-light" to="/precios">Comparar planes</Link>
        </div>
      </Reveal>
    </section>
  );
}

export default function AboutPage() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Sobre Benefy | Lealtad conectada con la operación';
    return () => { document.title = previousTitle; };
  }, []);

  return (
    <LandingMotionProvider>
      <main className="about-real-page">
        <AboutHero />
        <WhyBenefy />
        <TwoExperiences />
        <Roles />
        <Transparency />
        <AboutCTA />
      </main>
    </LandingMotionProvider>
  );
}
