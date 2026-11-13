import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToHash() {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;

    const target = document.getElementById(hash.slice(1));
    if (!target) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  }, [hash]);

  return null;
}
