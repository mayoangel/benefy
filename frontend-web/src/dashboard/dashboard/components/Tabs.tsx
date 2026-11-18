import { useId, type ReactNode } from 'react';
export default function Tabs({ labels, selected, onSelect, children }: { labels: string[]; selected: number; onSelect: (index: number) => void; children: ReactNode }) {
  const id = useId();
  return <>
    <div className="bd-tabs" role="tablist" aria-label="Secciones" onKeyDown={event => {
      const keys: Record<string, number> = { ArrowRight: (selected + 1) % labels.length, ArrowLeft: (selected + labels.length - 1) % labels.length, Home: 0, End: labels.length - 1 };
      const index = keys[event.key]; if (index === undefined) return; event.preventDefault(); onSelect(index); document.getElementById(`${id}-tab-${index}`)?.focus();
    }}>{labels.map((label, i) => <button key={label} id={`${id}-tab-${i}`} role="tab" aria-selected={selected === i} aria-controls={`${id}-panel-${i}`} tabIndex={selected === i ? 0 : -1} onClick={() => onSelect(i)}>{label}</button>)}</div>
    <section id={`${id}-panel-${selected}`} role="tabpanel" aria-labelledby={`${id}-tab-${selected}`} tabIndex={0}>{children}</section>
  </>;
}
