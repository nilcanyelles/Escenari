"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { IMPORT_COLUMNS, parseImportRows, type ParsedImport } from "@/lib/concert-import";
import { importConcertRowsAction } from "@/app/(app)/concerts/actions";
import { formatDate } from "@/lib/format";

const TEMPLATE_EXAMPLES: (string | number)[][] = [
  ["12/07/2026", "22:00", "Confirmat", "Els Catarres", "Festa Major", "Reus", "ES", "Plaça Mercadal", 1800, "Maria Puig", "Ajuntament de Reus", "600 000 000", "cultura@reus.cat"],
  ["02/08/2026", "", "Reservat", "Els Catarres", "Festes de Sant Roc", "Olot", "ES", "", "", "", "", "", ""],
];

// Importació de concerts des d'un Excel: primer es descarrega la plantilla
// (les columnes que s'entenen, amb dues files d'exemple), s'omple una fila
// per concert i es torna a pujar aquí. Es llegeix al navegador (xlsx), es
// mostra què s'importarà i quines files tenen error, i només en confirmar
// es creen els concerts (i els grups que no existeixin).
export default function ImportConcertsModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function downloadTemplate() {
    const headers = IMPORT_COLUMNS.map((c) => c.header);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...TEMPLATE_EXAMPLES]);
    ws["!cols"] = IMPORT_COLUMNS.map((c) => ({ wch: Math.max(14, c.header.length + 6) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Concerts");
    XLSX.writeFile(wb, "plantilla-concerts.xlsx");
  }

  async function readFile(file: File) {
    setReadError(null);
    setResult(null);
    setParsed(null);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error("El fitxer no té cap full.");
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" });
      if (!aoa.length) throw new Error("El full és buit.");
      setParsed(parseImportRows(aoa[0] || [], aoa.slice(1)));
    } catch (e) {
      setReadError(e instanceof Error ? e.message : "No s'ha pogut llegir el fitxer.");
    }
  }

  async function doImport() {
    if (!parsed || !parsed.concerts.length) return;
    setImporting(true);
    setReadError(null);
    try {
      const r = await importConcertRowsAction(parsed.concerts);
      setResult(r);
      router.refresh();
    } catch (e) {
      setReadError(e instanceof Error ? e.message : "No s'ha pogut importar.");
    } finally {
      setImporting(false);
    }
  }

  function isFileDrag(e: React.DragEvent) {
    return Array.from(e.dataTransfer?.types || []).includes("Files");
  }

  const ready = parsed ? parsed.concerts.length : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Importa concerts des d&apos;Excel</div>
          <button className="cf-head-close" title="Tancar" aria-label="Tancar" onClick={onClose}>✕</button>
        </div>
        <div className="modal-form">
          {result ? (
            <>
              <div className="imp-summary">
                <div><strong>{result.imported}</strong> {result.imported === 1 ? "concert importat" : "concerts importats"}.</div>
                {result.errors.length > 0 && (
                  <div className="imp-errors">
                    {result.errors.map((e, i) => <div key={i}>· {e}</div>)}
                  </div>
                )}
              </div>
              <div className="imp-actions">
                <button type="button" className="btn-save" onClick={onClose}>Fet</button>
              </div>
            </>
          ) : (
            <>
              <div className="imp-steps">
                <div><strong>1.</strong> Descarrega la plantilla i omple una fila per concert (les dues files d&apos;exemple es poden esborrar).</div>
                <div><strong>2.</strong> Puja el fitxer omplert aquí sota — es crearan tots els concerts de cop, i els grups que encara no existeixin.</div>
              </div>
              <button type="button" className="btn-outline" style={{ alignSelf: "flex-start" }} onClick={downloadTemplate}>
                ⬇ Descarrega la plantilla (.xlsx)
              </button>

              <div
                className={"imp-drop" + (dragOver ? " dragover" : "")}
                role="button" tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
                onDragEnter={(e) => { if (isFileDrag(e)) { e.preventDefault(); setDragOver(true); } }}
                onDragOver={(e) => { if (isFileDrag(e)) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
                onDrop={(e) => {
                  if (!isFileDrag(e)) return;
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f) readFile(f);
                }}
              >
                <input ref={inputRef} type="file" hidden accept=".xlsx,.xls,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ""; }} />
                {fileName ? <><strong>{fileName}</strong><br /><span className="t-dim">Clica o arrossega un altre fitxer per canviar-lo</span></> : "Arrossega l'Excel omplert aquí, o clica per triar-lo"}
              </div>

              {readError && <div className="pf-error">{readError}</div>}

              {parsed && (
                <div className="imp-summary">
                  {parsed.missing.length > 0 ? (
                    <div className="imp-errors">
                      Falten columnes obligatòries: {parsed.missing.map((k) => IMPORT_COLUMNS.find((c) => c.key === k)?.header).join(", ")}.
                      Fes servir la plantilla perquè les capçaleres coincideixin.
                    </div>
                  ) : (
                    <div>
                      <strong>{ready}</strong> {ready === 1 ? "concert a punt" : "concerts a punt"} d&apos;importar
                      {parsed.errors.length > 0 && <> · <span style={{ color: "oklch(0.78 0.14 25)" }}>{parsed.errors.length} {parsed.errors.length === 1 ? "fila amb error" : "files amb error"}</span></>}
                    </div>
                  )}
                  {ready > 0 && (
                    <div className="imp-preview">
                      {parsed.concerts.slice(0, 6).map((c, i) => (
                        <div key={i}>{formatDate(c.date)}{c.time ? ` ${c.time}` : ""} · {c.band} · {[c.title, c.city, c.venue].filter(Boolean).join(" · ") || "—"} · <span className="t-dim">{c.status}</span></div>
                      ))}
                      {ready > 6 && <div className="t-dim">… i {ready - 6} més</div>}
                    </div>
                  )}
                  {parsed.errors.length > 0 && (
                    <div className="imp-errors">
                      {parsed.errors.slice(0, 8).map((e) => <div key={e.row}>· Fila {e.row}: {e.message}</div>)}
                      {parsed.errors.length > 8 && <div>… i {parsed.errors.length - 8} més</div>}
                    </div>
                  )}
                  {parsed.unknownHeaders.length > 0 && (
                    <div className="t-dim" style={{ fontSize: 12 }}>Columnes ignorades: {parsed.unknownHeaders.join(", ")}</div>
                  )}
                </div>
              )}

              <div className="imp-actions">
                <button type="button" className="btn-outline" onClick={onClose}>Cancel·la</button>
                <button type="button" className="btn-save" disabled={importing || !ready || !!parsed?.missing.length} onClick={doImport}>
                  {importing ? "Important…" : ready ? `Importa ${ready} ${ready === 1 ? "concert" : "concerts"}` : "Importa"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
