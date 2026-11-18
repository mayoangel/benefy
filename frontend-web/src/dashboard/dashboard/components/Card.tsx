import type { ReactNode } from 'react';
export default function Card({ title, children, extra }: { title: string; children: ReactNode; extra?: ReactNode }) {
  return <section className="bd-card">
    <div className="bd-card-heading">
      <h2>{title}</h2>{extra}</div>{children}</section>;
}
