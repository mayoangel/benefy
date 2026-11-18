import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
export default function PageHeading({ title, description }: { title: string; description: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const { pathname } = useLocation();
  useEffect(() => { document.title = `${title} · Benefy`; heading.current?.focus(); }, [title, pathname]);
  return <div className="bd-page-heading">
    <div>
      <span className="bd-eyebrow">ADMINISTRACIÓN DEL NEGOCIO</span>
      <h1 ref={heading} tabIndex={-1}>{title}</h1>
      <p>{description}</p>
    </div>
  </div>;
}
