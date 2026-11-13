import { useEffect } from 'react';

export default function useReveal(selector: string) {
  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(selector),
    );

    if (!elements.length) {
      return;
    }

    elements.forEach((element) => element.classList.add('reveal'));

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    if (reducedMotion || !('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );

    elements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [selector]);
}
