"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { IMPORT_COLUMNS, parseImportRows, type ParsedImport } from "@/lib/concert-import";
import { importConcertRowsAction } from "@/app/(app)/concerts/actions";
import type { Band } from "@/lib/types";
import CreateGroupModal from "@/components/CreateGroupModal";

const TEMPLATE_EXAMPLES: (string | number)[][] = [
  ["12/07/2026", "22:00", "Confirmat", "Txarnego", "Festa Major", "Reus", "ES", "Plaça Mercadal", 1800, "Maria Puig", "Ajuntament de Reus", "600 000 000", "cultura@reus.cat"],
  ["02/08/2026", "", "Reservat", "Txarnego", "Festes de Sant Roc", "Olot", "ES", "", "", "", "", "", ""],
];

// Importació de concerts des d'un Excel: primer es descarrega la plantilla
// (les columnes que s'entenen, amb dues files d'exemple), s'omple una fila
// per concert i es torna a pujar aquí. Es llegeix al navegador (xlsx), es
// mostra què s'importarà i quines files tenen error, i només en confirmar
// es creen els concerts (i els grups que no existeixin).
export default function ImportConcertsModal({ bands = [], onClose }: { bands?: Band[]; onClose: () => void }) {
  const router = useRouter();
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [createBandName, setCreateBandName] = useState<string | null>(null);
  // Assignació manual d'un artista de l'Excel (que no existeix a l'agència)
  // a un grup ja existent, per si el nom no coincideix prou per detectar-ho
  // sol (per exemple, un àlies o una petita variació d'escriptura).
  const [assignBandKey, setAssignBandKey] = useState<string | null>(null);
  const [assignBandLabel, setAssignBandLabel] = useState("");
  const [assignSearch, setAssignSearch] = useState("");
  const [bandAssignments, setBandAssignments] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
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
    // Es puja en trams (no tot el fitxer d'un cop) perquè el botó pugui
    // anar mostrant quants concerts ja s'han creat ("Important… (X/Total)").
    const BATCH_SIZE = 10;
    const total = parsed.concerts.length;
    setProgress({ done: 0, total });
    try {
      // Els concerts d'un artista assignat manualment a un grup existent
      // s'importen amb el nom exacte d'aquell grup, perquè s'hi enganxin en
      // comptes de crear-ne un de nou.
      const rows = parsed.concerts.map((c) => {
        const assigned = bandAssignments[c.band.trim().toLowerCase()];
        return assigned ? { ...c, band: assigned } : c;
      });
      let imported = 0;
      const errors: string[] = [];
      for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
        const batch = rows.slice(offset, offset + BATCH_SIZE);
        const r = await importConcertRowsAction(batch, offset);
        imported += r.imported;
        errors.push(...r.errors);
        setProgress({ done: Math.min(offset + BATCH_SIZE, total), total });
      }
      setResult({ imported, errors });
      router.refresh();
    } catch (e) {
      setReadError(e instanceof Error ? e.message : "No s'ha pogut importar.");
    } finally {
      setImporting(false);
      setProgress(null);
    }
  }

  function isFileDrag(e: React.DragEvent) {
    return Array.from(e.dataTransfer?.types || []).includes("Files");
  }

  const ready = parsed ? parsed.concerts.length : 0;

  // Nombre de concerts per artista de l'Excel, i si l'artista ja existeix a
  // l'agència (comparació sense distingir majúscules, com fa la importació).
  const existingBandNames = new Set(bands.map((b) => b.name.trim().toLowerCase()));
  const bandCounts: { name: string; count: number; exists: boolean }[] = [];
  if (parsed) {
    const order: string[] = [];
    const counts: Record<string, number> = {};
    for (const c of parsed.concerts) {
      const key = c.band.trim().toLowerCase();
      if (!(key in counts)) { counts[key] = 0; order.push(key); }
      counts[key]++;
    }
    const nameByKey: Record<string, string> = {};
    for (const c of parsed.concerts) {
      const key = c.band.trim().toLowerCase();
      if (!(key in nameByKey)) nameByKey[key] = c.band.trim();
    }
    for (const key of order) {
      bandCounts.push({ name: nameByKey[key], count: counts[key], exists: existingBandNames.has(key) });
    }
  }

  const assignSearchLower = assignSearch.trim().toLowerCase();
  const filteredBands = bands.filter((b) => !assignSearchLower || b.name.toLowerCase().includes(assignSearchLower));

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
                  {bandCounts.length > 0 && (
                    <div className="imp-bands">
                      {bandCounts.map((b) => {
                        const key = b.name.toLowerCase();
                        const assigned = bandAssignments[key];
                        return (
                          <div key={key} className="imp-band-row">
                            <span>{b.name} — {b.count} {b.count === 1 ? "concert" : "concerts"}</span>
                            {!b.exists && (
                              assigned ? (
                                <span className="imp-band-assigned">
                                  → {assigned}
                                  <button type="button" className="imp-band-unassign" title="Desfés l'assignació"
                                    onClick={() => setBandAssignments((prev) => { const next = { ...prev }; delete next[key]; return next; })}>✕</button>
                                </span>
                              ) : (
                                <div className="imp-band-actions">
                                  <button type="button" className="btn-ghost-sm" onClick={() => setCreateBandName(b.name)}>+ Crea artista</button>
                                  <button type="button" className="btn-ghost-sm" onClick={() => { setAssignBandKey(key); setAssignBandLabel(b.name); setAssignSearch(""); }}>Assigna a un grup ja existent</button>
                                </div>
                              )
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {parsed.errors.length > 0 && (
                    <div className="imp-errors">
                      {parsed.errors.slice(0, 8).map((e) => <div key={e.row}>· Fila {e.row}: {e.message}</div>)}
                      {parsed.errors.length > 8 && <div>… i {parsed.errors.length - 8} més</div>}
                    </div>
                  )}
                </div>
              )}

              <div className="imp-actions">
                <button type="button" className="btn-outline" onClick={onClose}>Cancel·la</button>
                <button type="button" className="btn-save" disabled={importing || !ready || !!parsed?.missing.length} onClick={doImport}>
                  {importing ? `Important… (${progress?.done ?? 0}/${progress?.total ?? ready})` : ready ? `Importa ${ready} ${ready === 1 ? "concert" : "concerts"}` : "Importa"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {createBandName != null && (
        <CreateGroupModal initialName={createBandName} onClose={() => setCreateBandName(null)} />
      )}
      {assignBandKey != null && (
        <div className="modal-overlay" onClick={() => setAssignBandKey(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">Assigna &ldquo;{assignBandLabel}&rdquo; a un grup existent</div>
              <button className="cf-head-close" title="Tancar" aria-label="Tancar" onClick={() => setAssignBandKey(null)}>✕</button>
            </div>
            <div className="modal-form">
              <input className="field-input form-field" type="text" autoFocus placeholder="Cerca un grup…" value={assignSearch} onChange={(e) => setAssignSearch(e.target.value)} />
              <div className="imp-assign-list">
                {filteredBands.length ? filteredBands.map((b) => (
                  <button key={b.id} type="button" className="year-option" onClick={() => {
                    setBandAssignments((prev) => ({ ...prev, [assignBandKey]: b.name }));
                    setAssignBandKey(null);
                  }}>{b.name}</button>
                )) : <div className="cf-band-noresults">Cap grup coincideix</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
