import { useRef } from 'react';
import Modal from './Modal';
import { useDemoData } from '../data/DemoDataProvider';
import { useUI } from '../data/UIProvider';
import type { Branch } from '../data/demoData';
export function qrCells(id: number) {
  const cells: [number, number][] = [];
  for (let y = 0; y < 25; y++) for (let x = 0; x < 25; x++) {
    const finder = [[0, 0], [18, 0], [0, 18]].find(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7);
    let fill: boolean;
    if (finder) { const dx = x - finder[0]; const dy = y - finder[1]; fill = dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4); }
    else fill = ((x * 31 + y * 17 + id * 13 + x * y * 7) % 11) < 5;
    if (fill) cells.push([x, y]);
  }
  return cells;
}
export default function BranchQR({ branch, onClose }: { branch: Branch; onClose: () => void }) {
  const svg = useRef<SVGSVGElement>(null); const { setQrDownloaded } = useDemoData(); const { notify } = useUI();
  function download() {
    if (!svg.current) { notify('No se pudo preparar el SVG. Intenta de nuevo.'); return; }
    const source = new XMLSerializer().serializeToString(svg.current);
    const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `benefy-sucursal-${branch.id}-ejemplo.svg`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setQrDownloaded(previous => previous.includes(branch.id) ? previous : [...previous, branch.id]); notify('SVG de ejemplo descargado.');
  }
  return <Modal className="bd-qr-modal" title={`QR de ${branch.name}`} onClose={onClose}>
    <div className="bd-qr-print">
      <h3>{branch.name}</h3>
      <svg ref={svg} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 290 330" role="img" aria-label={`QR de ejemplo de ${branch.name}, no escaneable`}>
        <title>QR de ejemplo, no escaneable</title>
        <rect width="290" height="330" fill="white" />{qrCells(branch.id).map(([x, y]) => <rect key={`${x}-${y}`} x={20 + x * 10} y={20 + y * 10} width="10" height="10" fill="#123946" />)}<rect x="40" y="125" width="210" height="40" fill="white" />
        <text x="145" y="151" textAnchor="middle" fontFamily="sans-serif" fontSize="20" fill="#123946">DEMOSTRACIÓN</text>
        <text x="145" y="308" textAnchor="middle" fontFamily="sans-serif" fontSize="14" fill="#123946">QR de ejemplo, no escaneable</text>
      </svg>
      <p>
        <strong>QR de ejemplo, no escaneable</strong>
      </p>
      <p>Patrón ilustrativo para esta sucursal. No registra visitas.</p>
    </div>
    <div className="bd-form-actions">
      <button className="bd-button" onClick={download}>Descargar SVG</button>
      <button className="bd-secondary" onClick={() => window.print()}>Imprimir</button>
    </div>
  </Modal>;
}
