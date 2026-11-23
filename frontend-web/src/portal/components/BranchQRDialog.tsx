import { useEffect, useId, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

import type { SucursalResumen } from '../../lib/types.ts';

function escaparHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char] ?? char));
}

export default function BranchQRDialog({
  branch,
  businessName,
  kind = 'sucursal',
  onClose,
}: {
  branch: SucursalResumen;
  businessName: string;
  kind?: 'sucursal' | 'negocio';
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const qr = useRef<SVGSVGElement>(null);
  const id = useId();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const titulo = kind === 'negocio' ? 'QR del negocio' : `QR de ${branch.nombre}`;
  const nombreArchivo = kind === 'negocio' ? businessName : branch.nombre;

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);

  function descargar() {
    setError(null);
    const svg = qr.current;
    if (!svg) {
      setError('No se pudo preparar la imagen. Intenta de nuevo.');
      return;
    }
    const source = new XMLSerializer().serializeToString(svg);
    const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));
    const link = document.createElement('a');
    const nombre = `benefy-${nombreArchivo.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'visita'}.svg`;
    link.href = url;
    link.download = nombre;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMensaje('QR descargado en formato SVG.');
  }

  function imprimir() {
    setError(null);
    const svg = qr.current;
    if (!svg) {
      setError('No se pudo preparar el QR para imprimir.');
      return;
    }
    const ventana = window.open('', '_blank', 'width=760,height=900');
    if (!ventana) {
      setError('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes e intenta de nuevo.');
      return;
    }
    const business = escaparHtml(businessName);
    const branchName = escaparHtml(kind === 'negocio' ? 'Negocio completo' : branch.nombre);
    const svgMarkup = new XMLSerializer().serializeToString(svg);
    ventana.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8" />
      <title>${escaparHtml(titulo)}</title>
      <style>
        body { font-family: Arial, sans-serif; color: #002647; margin: 0; padding: 48px; text-align: center; }
        h1 { font-size: 26px; margin: 0 0 6px; }
        p { color: #526975; margin: 6px 0; }
        .qr { display: inline-block; padding: 20px; border: 1px solid #dce5e9; border-radius: 18px; margin: 28px 0 20px; }
        .code { font-family: monospace; font-size: 11px; color: #526975; overflow-wrap: anywhere; }
      </style></head><body>
      <h1>${business}</h1>
      <p>${branchName}</p>
      <div class="qr">${svgMarkup}</div>
      <p><strong>Escanea este código desde la app Benefy para registrar tu visita.</strong></p>
      <p>Una visita válida por negocio al día.</p>
      <p class="code">${escaparHtml(branch.qr_uuid)}</p>
      </body></html>`);
    ventana.document.close();
    ventana.focus();
    ventana.print();
  }

  async function copiar() {
    setError(null);
    try {
      await navigator.clipboard.writeText(branch.qr_uuid);
      setMensaje('Código copiado.');
    } catch {
      setError('No se pudo copiar el código. Puedes seleccionarlo manualmente.');
    }
  }

  return (
    <dialog
      ref={dialog}
      className="portal-qr-dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-help`}
      onClose={onClose}
      onCancel={() => {
        // El cierre con Escape delega en el cierre nativo del dialog.
      }}
    >
      <div className="portal-qr-head">
        <div>
          <span className="portal-eyebrow">Punto de visita</span>
          <h2 id={`${id}-title`}>{titulo}</h2>
          <p>{kind === 'negocio' ? `${businessName} · Negocio completo` : businessName}</p>
        </div>
        <button type="button" className="portal-button-secondary" onClick={onClose}>
          Cerrar
        </button>
      </div>

      <div className="portal-qr-card">
        <div className="portal-qr-code">
          <QRCodeSVG
            ref={qr}
            value={branch.qr_uuid}
            size={236}
            level="M"
            marginSize={4}
            fgColor="#002647"
            bgColor="#ffffff"
            title={`QR para registrar visitas en ${kind === 'negocio' ? businessName : branch.nombre}`}
          />
        </div>
        <div className="portal-qr-copy">
          <strong>Escanea para registrar tu visita</strong>
          <p id={`${id}-help`}>
            Abre la app Benefy, entra a escanear QR y apunta la cámara a este código.
            El sistema valida una visita por negocio al día.
          </p>
          <code>{branch.qr_uuid}</code>
          <button type="button" className="portal-button-secondary" onClick={() => void copiar()}>
            Copiar código
          </button>
        </div>
      </div>

      {mensaje ? <p className="portal-note" role="status">{mensaje}</p> : null}
      {error ? <p className="portal-state portal-state-error" role="alert">{error}</p> : null}

      <div className="portal-qr-actions">
        <button type="button" className="portal-button-secondary" onClick={descargar}>
          Descargar SVG
        </button>
        <button type="button" className="portal-button" onClick={imprimir}>
          Imprimir QR
        </button>
      </div>
    </dialog>
  );
}
