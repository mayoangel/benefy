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
  ['Clientes, visitas y cupones', 'Ilimitados', 'Ilimitados'],
];

export default function PricingPage() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Planes Free y Premium | Benefy';
    return () => { document.title = previousTitle; };
  }, []);

  return (
    <LandingMotionProvider>
      <main className="pricing-real-page">
      <PlansSection
        headingLevel="h1"
        intro="Los límites de esta página provienen del catálogo real del backend. Premium se muestra con un precio de referencia porque el cobro aún no está definido."
      />

      <section className="landing-section pricing-real-comparison" aria-labelledby="pricing-comparison-title">
        <Reveal className="container pricing-real-grid">
          <div className="landing-section-head">
            <span className="landing-kicker">Comparación operativa</span>
            <h2 id="pricing-comparison-title">La diferencia actual está en la capacidad.</h2>
            <p>
              Ambos planes usan los mismos flujos de puntos, sellos, recompensas,
              cupones, canjes y seguimiento. Premium permite operar más recursos activos.
            </p>
            <div className="pricing-real-notes">
              <span><FontAwesomeIcon icon={faLock} /> Los límites se validan al crear o reactivar recursos.</span>
              <span><FontAwesomeIcon icon={faRotate} /> Un cambio de plan no borra datos ni historial.</span>
              <span><FontAwesomeIcon icon={faCircleInfo} /> Los recursos inactivos no consumen cupo.</span>
            </div>
          </div>

          <div className="pricing-real-table-wrap" role="region" aria-label="Comparación de planes" tabIndex={0}>
            <table className="pricing-real-table">
              <caption className="sr-only">Límites actuales de los planes Free y Premium</caption>
              <thead><tr><th scope="col">Recurso</th><th scope="col">Free</th><th scope="col">Premium</th></tr></thead>
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
            <span className="landing-kicker landing-kicker-light">Activación transparente</span>
            <h2 id="pricing-contact-title">Free está listo al registrar tu negocio.</h2>
            <p>
              Premium requiere activación manual. Benefy todavía no procesa pagos,
              renovaciones o cancelaciones desde la web.
            </p>
          </div>
          <div className="landing-actions">
            <Link className="landing-button landing-button-mint" to="/registro">Crear negocio con Free</Link>
            <Link className="landing-text-link landing-text-link-light" to="/login">Entrar al portal</Link>
          </div>
        </Reveal>
      </section>
      </main>
    </LandingMotionProvider>
  );
}
