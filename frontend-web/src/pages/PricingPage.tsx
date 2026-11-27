import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleInfo, faLock, faRotate } from '@fortawesome/free-solid-svg-icons';

import PlansSection from '../components/PlansSection.tsx';
import { LandingMotionProvider, Reveal } from '../components/LandingMotion.tsx';

const comparison = [
  ['Sucursales activas', '1', '5'],
  ['Programas de puntos activos', '1', '1'],
  ['Tarjetas de sellos activas', '2', '10'],
  ['Recompensas activas', '5', '30'],
  ['Supervisores activos', '1', '5'],
  ['Empleados activos', '3', '20'],
  ['Alianzas activas', '1', '4'],
  ['Clientes, visitas y cupones', 'Ilimitados', 'Ilimitados'],
];

export default function PricingPage() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Planes gratis y premium | Benefy';
    return () => { document.title = previousTitle; };
  }, []);

  return (
    <LandingMotionProvider>
      <main className="pricing-real-page">
      <PlansSection
        headingLevel="h1"
        intro="Elige el plan que acompaña el tamaño de tu operación. Puedes empezar gratis y cambiar cuando tu negocio lo necesite."
      />

      <section className="landing-section pricing-real-comparison" aria-labelledby="pricing-comparison-title">
        <Reveal className="container pricing-real-grid">
          <div className="landing-section-head">
            <span className="landing-kicker">Comparación de planes</span>
            <h2 id="pricing-comparison-title">La diferencia está en la capacidad de tu operación.</h2>
            <p>
              Ambos planes incluyen puntos, sellos, recompensas, cupones, canjes y
              seguimiento. El plan premium permite operar más recursos activos.
            </p>
            <div className="pricing-real-notes">
              <span><FontAwesomeIcon icon={faLock} /> Los límites se validan al crear o reactivar recursos.</span>
              <span><FontAwesomeIcon icon={faRotate} /> Un cambio de plan no borra datos ni historial.</span>
              <span><FontAwesomeIcon icon={faCircleInfo} /> Los recursos inactivos no consumen cupo.</span>
              <span><FontAwesomeIcon icon={faLock} /> El plan gratis puede recibir y aceptar una alianza activa; proponer es exclusivo del plan premium. El plan premium permite más alianzas activas.</span>
            </div>
          </div>

          <div className="pricing-real-table-wrap" role="region" aria-label="Comparación de planes" tabIndex={0}>
            <table className="pricing-real-table">
              <caption className="sr-only">Límites de los planes gratis y premium</caption>
              <thead><tr><th scope="col">Recurso</th><th scope="col">Plan gratis</th><th scope="col">Plan premium</th></tr></thead>
              <tbody>
                {comparison.map(([resource, free, premium]) => (
                  <tr key={resource}><th scope="row">{resource}</th><td>{free}</td><td>{premium}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </section>

      <section className="pricing-real-cta" id="contacto" aria-labelledby="pricing-contact-title">
        <Reveal className="container pricing-real-cta-inner">
          <div>
            <span className="landing-kicker landing-kicker-light">Empieza hoy</span>
            <h2 id="pricing-contact-title">El plan gratis está listo cuando registras tu negocio.</h2>
            <p>
              El plan premium se contrata desde la sección de Suscripción del
              portal. Antes de confirmar verás el importe y las condiciones. En el
              entorno actual de facturación de prueba no se realizan cargos reales.
            </p>
          </div>
          <div className="landing-actions">
            <Link className="landing-button landing-button-mint" to="/registro">Crear mi cuenta gratis</Link>
            <Link className="landing-text-link landing-text-link-light" to="/login">Entrar al portal</Link>
          </div>
        </Reveal>
      </section>
      </main>
    </LandingMotionProvider>
  );
}
