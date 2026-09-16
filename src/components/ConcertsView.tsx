"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Band, Concert, Contact } from "@/lib/types";
import { formatDate, statusColors, isConcertOver } from "@/lib/format";
import { KIND_META } from "@/components/CalendariView";
import { uniqueTags } from "@/lib/tags";
import { normalize } from "@/lib/text";
import { rsCompletionPercent } from "@/lib/route-sheet";
import { memberPerms } from "@/lib/perms";
import NewEventButton from "@/components/NewEventButton";
import ImportConcertsModal from "@/components/ImportConcertsModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { rsIsComplete } from "@/lib/route-sheet";
import { deleteConcertAction, saveConcertAction, setConcertStatusAction } from "@/app/(app)/concerts/actions";
import { setMyAttendanceAction } from "@/app/(artist)/actions";
import ConcertModal from "@/components/ConcertModal";
import RouteSheetModal from "@/components/RouteSheetModal";
import RouteSheetPreview from "@/components/RouteSheetPreview";

function HourglassIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-1px", flex: "none" }}>
      <path d="M5 22h14"></path>
      <path d="M5 2h14"></path>
      <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"></path>
      <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"></path>
    </svg>
  );
}

const STATUS_CYCLE = ["cancel·lat", "pendent", "reservat", "confirmat"];
function nextStatus(status: string): string {
  const i = STATUS_CYCLE.indexOf(status);
  return STATUS_CYCLE[(i === -1 ? 0 : i + 1) % STATUS_CYCLE.length];
}

// Creueta d'eliminar un concert d'una llista, amb diàleg de confirmació
// propi (mai el del navegador). "label" és com anomenar el concert al
// diàleg; "onDeleted" substitueix el refresc de pàgina per defecte.
export function DeleteConcertBtn({ id, label, onDeleted }: { id: string; label?: string; onDeleted?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button
        className="row-delete-btn"
        title="Eliminar concert"
        aria-label="Eliminar concert"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      {open && (
        <ConfirmDialog
          title="Eliminar el concert?"
          message={<>{label && <><strong>{label}</strong><br /></>}S&apos;esborrarà amb el full de ruta, el repartiment i la factura que hi hagi. No es pot desfer.</>}
          confirmLabel="Elimina" busy={busy}
          onCancel={() => setOpen(false)}
          onConfirm={async () => {
            setBusy(true);
            await deleteConcertAction(id);
            setBusy(false);
            setOpen(false);
            if (onDeleted) onDeleted(); else router.refresh();
          }}
        />
      )}
    </>
  );
}

function RouteSheetBtns({ c, onEdit, onPreview }: { c: Concert; onEdit: () => void; onPreview: () => void }) {
  return (
    <>
      <button className="row-rs-btn" title="Edita el full de ruta" aria-label="Edita el full de ruta" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
        </svg>
      </button>
      <button className={"row-rs-btn" + (rsIsComplete(c) ? " rs-complete" : "")} title="Previsualitza el full de ruta" aria-label="Previsualitza el full de ruta" onClick={(e) => { e.stopPropagation(); onPreview(); }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle>
        </svg>
      </button>
    </>
  );
}

export default function ConcertsView({ bands, concerts, selectedBandId = "", viewer = "manager", canCreate = true, allowBolo, detailBase = "/concerts", contacts = [], myNames, today }: { bands: Band[]; concerts: Concert[]; selectedBandId?: string; viewer?: "manager" | "artist"; canCreate?: boolean; allowBolo?: boolean; detailBase?: string; contacts?: Contact[]; myNames?: Record<string, string>; today: string }) {
  const isMgr = viewer === "manager";
  const inBand = !!selectedBandId; // dins d'un grup, la columna Grup s'amaga
  const colsClass = "ccols" + (inBand ? " ccols-noband" : "");
  const router = useRouter();
  // Un cop respost (sí o no) a la teva pròpia convocatòria, la fila mostra
  // el resum d'assistència en comptes dels botons — mateix comportament que
  // "Els meus grups" (tocar-lo torna a mostrar els botons).
  const [attEditing, setAttEditing] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("tots");
  const [tagFilter, setTagFilter] = useState("tots");
  const [kindFilter, setKindFilter] = useState("tots");
  const [modal, setModal] = useState<{ concertId: string } | null>(null);
  const [draftConcert, setDraftConcert] = useState<Concert | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const PAGE_SIZE = 50;
  const [upcomingVisible, setUpcomingVisible] = useState(PAGE_SIZE);
  const [pastVisible, setPastVisible] = useState(PAGE_SIZE);
  const [rsModalConcertId, setRsModalConcertId] = useState<string | null>(null);
  const [rsPreviewConcertId, setRsPreviewConcertId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const statusSaveTimers = useRef<Record<string, number>>({});

  useEffect(() => {
    if (modal?.concertId) {
      const el = rowRefs.current[modal.concertId];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [modal]);

  useEffect(() => {
    setUpcomingVisible(PAGE_SIZE);
    setPastVisible(PAGE_SIZE);
  }, [search, statusFilter, tagFilter, kindFilter]);

  // Reconcile optimistic status overrides against the server-confirmed prop: only
  // drop an override once `concerts` (refreshed by router.refresh() after the write)
  // actually agrees with it. Clearing on a timer/guess instead of this causes a
  // visible flicker back to the stale value while the refresh is still in flight.
  useEffect(() => {
    setStatusOverrides((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      let changed = false;
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        const serverConcert = concerts.find((c) => c.id === id);
        if (serverConcert && serverConcert.status === next[id]) { delete next[id]; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [concerts]);

  // Cerca sense distingir accents ni majúscules (Sant Adrià = sant adria).
  const searchL = normalize(search);
  const list = concerts.filter((c) =>
    (statusFilter === "tots" || c.status === statusFilter) &&
    (tagFilter === "tots" || (c.tags && c.tags.indexOf(tagFilter) !== -1)) &&
    (kindFilter === "tots" || (c.kind && KIND_META[c.kind] ? c.kind : "bolo") === kindFilter) &&
    (!searchL || normalize(c.bandName).includes(searchL) || normalize(c.venue).includes(searchL) || normalize(c.city).includes(searchL) || normalize(c.festaEntitat || "").includes(searchL))
  );
  // "Realitzat" mira si el concert ja s'ha acabat del tot (data i hora
  // exactes, amb un marge prudent — vegeu isConcertOver) — no es dona per
  // fet només perquè ja hagi començat, ni perquè el calendari ja hagi
  // passat del seu dia efectiu (per a un concert de matinada).
  const upcomingList = list.filter((c) => !isConcertOver(c.date, c.time)).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const pastList = list.filter((c) => isConcertOver(c.date, c.time)).sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

  const tagOpts = uniqueTags(concerts);

  function ConcertRow({ c }: { c: Concert }) {
    const displayStatus = statusOverrides[c.id] ?? c.status;
    const sc = statusColors(displayStatus);
    const isSelected = modal?.concertId === c.id;
    // Assistència de músics i crew — mateix càlcul que la barra del bànner
    // del concert (AttendanceMeter): els exclosos de la convocatòria
    // d'aquest concert no compten enlloc (ni al total).
    const rowBand = bands.find((b) => b.id === c.bandId);
    const attPeople = rowBand ? [...rowBand.members, ...rowBand.crew] : [];
    const attExcluded = c.convocatoriaExcluded || {};
    const attActive = attPeople.filter((p) => !attExcluded[p.name]);
    const attTotal = attActive.length;
    const attendanceMap = c.attendance || {};
    const attYesNames = attActive.filter((p) => attendanceMap[p.name] === "yes").map((p) => p.name);
    const attNoNames = attActive.filter((p) => attendanceMap[p.name] === "no").map((p) => p.name);
    const attPendingNames = attActive.filter((p) => attendanceMap[p.name] !== "yes" && attendanceMap[p.name] !== "no").map((p) => p.name);
    const attYes = attYesNames.length;
    const attNo = attNoNames.length;
    const attYesPct = attTotal ? (attYes / attTotal) * 100 : 0;
    const attNoPct = attTotal ? (attNo / attTotal) * 100 : 0;
    const rsPct = rsCompletionPercent(c);
    // Ets tu qui hi és convocat (no el gestor, i no exclòs d'aquesta
    // convocatòria en concret) — llavors marques la teva pròpia assistència
    // amb tick/creu en comptes de només veure el resum de tothom.
    const myName = myNames?.[c.bandId];
    const myAns = myName ? attendanceMap[myName] : undefined;
    const myPerson = myName ? attPeople.find((p) => p.name === myName) : undefined;
    const myIsAdmin = myPerson ? memberPerms(myPerson).admin : false;
    // Si t'han exclòs d'aquesta convocatòria en concret: si ets admin del
    // grup, t'ho diem directament a la columna ("No convocat", sense haver
    // de passar-hi el cursor) — si no ho ets, no et surt res especial (com
    // si la columna no existís per a tu). El tooltip de l'agregat, en canvi,
    // només llista gent convocada.
    const myIsExcluded = !isMgr && !!myName && !!attExcluded[myName];
    const iAmConvoked = !isMgr && !!myName && !attExcluded[myName];
    const showButtons = iAmConvoked && (!myAns || attEditing.has(c.id));
    return (
      <div ref={(el) => { rowRefs.current[c.id] = el; }} className={"t-row " + colsClass + " clickable" + (isSelected ? " selected" : "")} onClick={() => router.push(`${detailBase}/${c.id}`)}>
        <div className="t-dim">{formatDate(c.date)}{c.time ? <span className="cc-time"> · {c.time}</span> : ""}</div>
        <div>
          {(() => {
            const k = c.kind && KIND_META[c.kind] ? c.kind : "bolo";
            return <span className="cc-kind" style={{ background: KIND_META[k].bg, color: KIND_META[k].color }}>{KIND_META[k].label}</span>;
          })()}
        </div>
        {!inBand && <div className="t-strong">{c.bandName}</div>}
        <div className="cc-bold">{c.city ? c.city.split(",")[0] : "—"}</div>
        <div className="cc-bold">{c.venue || "—"}</div>
        <div className="cc-bold">{c.festaEntitat || "—"}</div>
        <div style={{ textAlign: "center" }} onClick={(e) => { if (showButtons) e.stopPropagation(); }}>
          {myIsExcluded ? (
            myIsAdmin ? <span className="t-dim">No convocat</span> : <span className="t-dim">—</span>
          ) : showButtons ? (
            <span className="cd-att-controls" style={{ justifyContent: "center" }}>
              <button
                type="button" className={"cd-att-btn cd-att-icon-btn yes" + (myAns === "yes" ? " active" : "")}
                title={myAns === "yes" ? "Hi seré — toca per treure la resposta" : "Hi seré"}
                onClick={async (e) => {
                  e.stopPropagation();
                  await setMyAttendanceAction(c.id, myAns === "yes" ? null : "yes");
                  setAttEditing((prev) => { const next = new Set(prev); next.delete(c.id); return next; });
                  router.refresh();
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </button>
              <button
                type="button" className={"cd-att-btn cd-att-icon-btn no" + (myAns === "no" ? " active" : "")}
                title={myAns === "no" ? "No hi seré — toca per treure la resposta" : "No hi seré"}
                onClick={async (e) => {
                  e.stopPropagation();
                  await setMyAttendanceAction(c.id, myAns === "no" ? null : "no");
                  setAttEditing((prev) => { const next = new Set(prev); next.delete(c.id); return next; });
                  router.refresh();
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </span>
          ) : attTotal > 0 ? (
            <div
              className="cc-att" style={iAmConvoked ? { cursor: "pointer", margin: "0 auto" } : { margin: "0 auto" }}
              title={iAmConvoked ? "Toca per canviar la teva resposta" : undefined}
              onClick={iAmConvoked ? (e) => { e.stopPropagation(); setAttEditing((prev) => new Set(prev).add(c.id)); } : undefined}
            >
              <div className="cc-att-track">
                <div className="cc-att-fill" style={{ width: attYesPct + "%", background: "oklch(0.72 0.15 155)" }}></div>
                <div className="cc-att-fill" style={{ width: attNoPct + "%", background: "var(--red)" }}></div>
              </div>
              <div className="cc-att-count">{attYes}/{attTotal}</div>
              <div className="cc-att-tooltip">
                <div className="cc-att-tooltip-title">Assistència:</div>
                <div className="cc-att-tooltip-list">
                  {attYesNames.map((n) => <span key={n} className="cd-att-bubble yes">✓ {n}</span>)}
                  {attNoNames.map((n) => <span key={n} className="cd-att-bubble no">✕ {n}</span>)}
                  {attPendingNames.map((n) => <span key={n} className="cd-att-bubble pending"><HourglassIcon />{n}</span>)}
                </div>
              </div>
            </div>
          ) : <span className="t-dim">—</span>}
        </div>
        <div>
          {isMgr ? (
            <button type="button" className="badge-btn" style={{ background: sc.bg, color: sc.color }}
              title="Canvia l'estat" aria-label="Canvia l'estat"
              onClick={(e) => {
                e.stopPropagation();
                const next = nextStatus(displayStatus);
                setStatusOverrides((prev) => ({ ...prev, [c.id]: next }));
                if (statusSaveTimers.current[c.id]) window.clearTimeout(statusSaveTimers.current[c.id]);
                statusSaveTimers.current[c.id] = window.setTimeout(async () => {
                  await setConcertStatusAction(c.id, next);
                  router.refresh();
                }, 400);
              }}>{displayStatus}</button>
          ) : (
            <span className="badge" style={{ background: sc.bg, color: sc.color }}>{displayStatus}</span>
          )}
        </div>
        <div className="cc-fdr">
          <span className="cc-fdr-pct" style={{ color: rsPct >= 100 ? "oklch(0.75 0.15 155)" : rsPct >= 50 ? "oklch(0.82 0.15 80)" : "var(--text-faint)" }}>{rsPct}%</span>
          <button className="row-rs-btn" title="Previsualitza el full de ruta" aria-label="Previsualitza el full de ruta" onClick={(e) => { e.stopPropagation(); setRsPreviewConcertId(c.id); }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
        </div>
        <div onClick={(e) => e.stopPropagation()}>{isMgr && <DeleteConcertBtn id={c.id} label={`${formatDate(c.date)} · ${c.bandName}${c.city ? " · " + c.city.split(",")[0] : ""}`} />}</div>
      </div>
    );
  }

  const editingConcert = modal
    ? concerts.find((c) => c.id === modal.concertId) || (draftConcert && draftConcert.id === modal.concertId ? draftConcert : null)
    : null;
  const isNewDraft = !!draftConcert && modal?.concertId === draftConcert.id;
  const rsModalConcert = rsModalConcertId ? concerts.find((c) => c.id === rsModalConcertId) || null : null;
  const rsPreviewConcert = rsPreviewConcertId ? concerts.find((c) => c.id === rsPreviewConcertId) || null : null;

  const navigableList = [...upcomingList, ...pastList];
  const navigableIndex = editingConcert ? navigableList.findIndex((c) => c.id === editingConcert.id) : -1;
  function navigateConcert(dir: "prev" | "next") {
    if (navigableIndex === -1) return;
    const nextIndex = dir === "prev" ? navigableIndex - 1 : navigableIndex + 1;
    const target = navigableList[nextIndex];
    if (target) setModal({ concertId: target.id });
  }

  async function handleNewConcert() {
    const created = await saveConcertAction({
      id: null,
      bandName: "",
      date: today,
      time: "",
      venue: "",
      city: "",
      festaEntitat: "",
      amount: 0,
      status: "pendent",
      attendance: {},
      substitutes: {},
      noSubstitute: {},
      skipDefaults: true,
    });
    if (!created) return;
    router.push(`/concerts/${created.id}`);
  }

  async function discardDraftAndClose() {
    if (draftConcert) {
      await deleteConcertAction(draftConcert.id);
      router.refresh();
    }
    setModal(null);
    setDraftConcert(null);
  }

  return (
    <div className="glow" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="glow-blooms" aria-hidden="true"></div>
      <div className="filter-bar concerts-filterbar">
        <input className="input search" type="text" placeholder="Cercar grup, sala, ciutat…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="tots">Tots els estats</option>
          <option value="confirmat">Confirmat</option>
          <option value="reservat">Reservat</option>
          <option value="pendent">Pendent</option>
          <option value="cancel·lat">Cancel·lat</option>
        </select>
        <select className="input" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
          <option value="tots">Totes les etiquetes</option>
          {tagOpts.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="input" value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
          <option value="tots">Tots els tipus</option>
          {Object.keys(KIND_META).map((k) => <option key={k} value={k}>{KIND_META[k].label}</option>)}
        </select>
        {isMgr && <button className="btn-outline" onClick={() => setImportOpen(true)} title="Importa concerts des d'un Excel (amb plantilla)">Importa</button>}
        {canCreate && <NewEventButton bands={bands} selectedBandId={selectedBandId} allowBolo={allowBolo ?? isMgr} defaultDate={today} detailBase={detailBase} />}
      </div>

      {importOpen && <ImportConcertsModal bands={bands} onClose={() => setImportOpen(false)} />}

      {upcomingList.length === 0 && pastList.length === 0 ? (
        <div className="empty-state">Cap concert coincideix amb els filtres.</div>
      ) : (
        <div className="concerts-list">
          <div className={"t-row t-head " + colsClass}>
            <div>Data</div><div>Tipus</div>{!inBand && <div>Grup</div>}<div>Població</div><div>Ubicació</div><div>Festa/entitat</div>
            <div style={{ textAlign: "center" }}>Assistència</div><div>Estat</div>
            <div style={{ textAlign: "center" }}>FDR</div><div></div>
          </div>
          <div className="table-wrap no-clip">
            {upcomingList.slice(0, upcomingVisible).map((c) => <ConcertRow key={c.id} c={c} />)}
          </div>
          {upcomingVisible < upcomingList.length && (
            <button type="button" className="load-more-btn" onClick={() => setUpcomingVisible((v) => v + PAGE_SIZE)}>
              Mostra {Math.min(PAGE_SIZE, upcomingList.length - upcomingVisible)} més ({upcomingList.length - upcomingVisible} restants)
            </button>
          )}
          {pastList.length > 0 && (
            <>
              <div className="concerts-section-divider">
                <span>Bolos realitzats</span>
                <span className="concerts-section-divider-count">{pastList.length}</span>
              </div>
              <div className="table-wrap no-clip">
                {pastList.slice(0, pastVisible).map((c) => <ConcertRow key={c.id} c={c} />)}
              </div>
            </>
          )}
          {pastVisible < pastList.length && (
            <button type="button" className="load-more-btn" onClick={() => setPastVisible((v) => v + PAGE_SIZE)}>
              Mostra {Math.min(PAGE_SIZE, pastList.length - pastVisible)} més ({pastList.length - pastVisible} restants)
            </button>
          )}
        </div>
      )}

      {modal && (
        <ConcertModal
          key={"edit:" + modal.concertId}
          mode="edit"
          concert={editingConcert}
          bands={bands}
          isDraft={isNewDraft}
          startInEditMode={isNewDraft}
          onDiscardDraft={discardDraftAndClose}
          onClose={() => { setModal(null); setDraftConcert(null); }}
          onOpenRouteSheetPreview={editingConcert ? () => { setModal(null); setDraftConcert(null); setRsPreviewConcertId(editingConcert.id); } : undefined}
          onNavigate={navigateConcert}
          hasPrev={navigableIndex > 0}
          hasNext={navigableIndex !== -1 && navigableIndex < navigableList.length - 1}
        />
      )}

      {rsModalConcert && (
        <RouteSheetModal
          key={rsModalConcert.id}
          concert={rsModalConcert}
          onClose={() => setRsModalConcertId(null)}
          onOpenPreview={() => { setRsModalConcertId(null); setRsPreviewConcertId(rsModalConcert.id); }}
          contacts={contacts}
        />
      )}
      {rsPreviewConcert && (
        <RouteSheetPreview
          concert={rsPreviewConcert}
          onClose={() => setRsPreviewConcertId(null)}
          onEdit={() => { setRsPreviewConcertId(null); setRsModalConcertId(rsPreviewConcert.id); }}
        />
      )}
    </div>
  );
}
