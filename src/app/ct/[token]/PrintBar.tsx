"use client";

// Barra de la vista pública del contracte: marca i botó d'imprimir/PDF.
export default function PrintBar({ bandName }: { bandName: string }) {
  return (
    <div className="ct-public-bar">
      <span className="pf-brand" style={{ margin: 0 }}>ESCENARI</span>
      <span className="t-dim" style={{ fontSize: 13 }}>Contracte d&apos;actuació · {bandName}</span>
      <div className="spacer"></div>
      <button type="button" className="btn-save" onClick={() => window.print()}>Imprimeix / PDF</button>
    </div>
  );
}
