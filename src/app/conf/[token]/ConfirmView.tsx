"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { respondConfAction, listBackupCandidatesAction, proposeSubstituteAction, createSubstituteLinkAction } from "@/app/conf/actions";
import { logoBox } from "@/lib/logo";
import { personPhotoDataUri } from "@/lib/tags";
import { normalize } from "@/lib/text";
import { formatDateFull, capitalize, formatConcertTime, timePeriodFor, WEEKDAY_FULL, MONTH_ABBR } from "@/lib/format";
import type { Concert, Band } from "@/lib/types";
import type { Setlist } from "@/lib/material-types";
import DiaBody from "@/components/DiaBody";
import VerifiedTick from "@/components/VerifiedTick";
import RouteSheetPreview from "@/components/RouteSheetPreview";
import { KIND_META } from "@/components/CalendariView";
import { TimePeriodIcon } from "@/components/TimePeriodBubble";
import { SetlistButton } from "@/components/GroupHomeView";
import { normalizeRouteSheet, withLiveConcertStart, type RouteSheet } from "@/lib/route-sheet";

function kindOf(c: Concert): string {
  return c.kind && KIND_META[c.kind] ? c.kind : "bolo";
}

function InfoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
  );
}
function FdrIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <text x="12" y="17.5" textAnchor="middle" fontSize="6.3" fontWeight="700" fontFamily="Inter,sans-serif" stroke="none" fill="currentColor">FDR</text>
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
    </svg>
  );
}

export type ConfMember = {
  name: string;
  instruments: string[];
  photoId: string;
  // Ja té el compte vinculat a aquest membre del grup (band_members).
  linked: boolean;
  // Té compte d'Escenari (vinculat, o un perfil amb el mateix correu) —
  // se li demana entrar; si no, crear-se'l.
  hasAccount: boolean;
  isMe: boolean;
};

export type ConfViewer = {
  loggedIn: boolean;
  role: "manager" | "artist" | "none";
  // Membre d'aquest grup a què ja està vinculat el compte que mira la
  // pàgina (buit si cap).
  linkedMemberName: string;
};

// Cerca de suplent oberta per a un membre i un concert: qui s'hi ha
// presentat (o ha estat proposat) i l'enllaç del suplent, si n'hi ha.
export type ConfSubInfo = {
  requestId: string;
  token: string;
  applications: { name: string; status: "pendent" | "acceptada" | "rebutjada" }[];
};

// Què cal per poder respondre, un cop triat qui ets.
type Gate = "signin" | "signup" | "wrong-account" | "manager" | "table";

// Data curta per a cada fila de la taula ("Dis 12 oct", amb l'any només si
// no és el d'enguany).
function rowDate(date: string): string {
  const p = date.split("-").map(Number);
  const dt = new Date(p[0], p[1] - 1, p[2]);
  const sameYear = dt.getFullYear() === new Date().getFullYear();
  return `${WEEKDAY_FULL[dt.getDay()].slice(0, 3)} ${p[2]} ${MONTH_ABBR[p[1] - 1]}${sameYear ? "" : " " + p[0]}`;
}

export default function ConfirmView({ token, single, allFuture, band, concerts, diaBand, members, linkedNames = [], subs = {}, viewer, preselect, setlists = [] }: {
  token: string;
  // Enllaç d'un sol concert (els de sempre): es mostra el pòster i els
  // detalls del dia a dalt de tot, com fins ara.
  single: boolean;
  allFuture: boolean;
  band: { name: string; logo: string; logoAspect?: string; color1: string; color2: string };
  // Cerques de suplent obertes: concert → membre (normalitzat) → info.
  subs?: Record<string, Record<string, ConfSubInfo>>;
  concerts: Concert[];
  diaBand: Band | null;
  members: ConfMember[];
  // Noms amb compte vinculat, per al tick lila de "Qui ve" (DiaBody).
  linkedNames?: string[];
  viewer: ConfViewer;
  preselect: string;
  // Per al botó "Setlist" del pòster de cada concert — només lectura aquí
  // (mai es crea ni s'assigna des d'aquesta pàgina pública).
  setlists?: Setlist[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>(() =>
    members.some((m) => m.name === preselect) ? preselect : members.find((m) => m.isMe)?.name || ""
  );
  // Respostes per concert i membre — còpia local per pintar-les a l'instant.
  const [answers, setAnswers] = useState<Record<string, Record<string, "yes" | "no" | "potser">>>(() => {
    const out: Record<string, Record<string, "yes" | "no" | "potser">> = {};
    concerts.forEach((c) => { out[c.id] = { ...(c.attendance || {}) }; });
    return out;
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Un cop respost (sí o no), la fila mostra el resum d'assistència en
  // comptes dels botons — mateix comportament que "Els meus grups" i la
  // pestanya de concerts (tocar-lo torna a mostrar els botons).

  // ---- Proposar un suplent (quan es diu que no) ----
  const [subsLocal, setSubsLocal] = useState(subs);
  const [subPanel, setSubPanel] = useState<{ concertId: string; mode: "search" | "link"; phone?: string } | null>(null);
  const [subQ, setSubQ] = useState("");
  // Suplents de confiança del grup (band.backups) — es carreguen un sol cop
  // en obrir el panell (no a cada tecla) i es filtren en local mentre
  // s'escriu; ja venen ordenats amb qui toca algun instrument en comú
  // primer. Tant se val si tenen compte d'Escenari o no.
  const [subBackups, setSubBackups] = useState<{ name: string; instruments: string[]; phone: string; email: string; clerkUserId: string }[]>([]);
  const [subBackupsLoading, setSubBackupsLoading] = useState(false);
  const [subBusy, setSubBusy] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);
  const [subLink, setSubLink] = useState<string | null>(null);
  const [subCopied, setSubCopied] = useState(false);

  async function openSubPanel(concertId: string, memberName: string) {
    setSubPanel({ concertId, mode: "search" });
    setSubQ("");
    setSubError(null);
    setSubCopied(false);
    setSubBackups([]);
    setSubBackupsLoading(true);
    const list = await listBackupCandidatesAction(token, concertId, memberName);
    setSubBackups(list);
    setSubBackupsLoading(false);
  }
  const filteredBackups = subQ.trim()
    ? subBackups.filter((b) => normalize(b.name).includes(normalize(subQ.trim())))
    : subBackups;
  function addLocalApplication(concertId: string, memberName: string, name: string, tokenValue?: string) {
    setSubsLocal((prev) => {
      const byMember = { ...(prev[concertId] || {}) };
      const key = normalize(memberName);
      const cur = byMember[key] || { requestId: "", token: "", applications: [] };
      byMember[key] = {
        ...cur,
        token: tokenValue ?? cur.token,
        applications: name && !cur.applications.some((a) => a.name === name) ? [...cur.applications, { name, status: "pendent" as const }] : cur.applications,
      };
      return { ...prev, [concertId]: byMember };
    });
  }
  async function proposeCandidate(concertId: string, memberName: string, cand: { clerkUserId: string; name: string }) {
    setSubBusy(true);
    setSubError(null);
    const res = await proposeSubstituteAction(token, concertId, memberName, cand.clerkUserId);
    setSubBusy(false);
    if (!res.ok) { setSubError(res.error || "No s'ha pogut proposar."); return; }
    addLocalApplication(concertId, memberName, res.name || cand.name);
    setSubPanel(null);
    router.refresh();
  }
  async function makeSubLink(concertId: string, memberName: string, phone?: string) {
    setSubBusy(true);
    setSubError(null);
    const res = await createSubstituteLinkAction(token, concertId, memberName);
    setSubBusy(false);
    if (!res.ok || !res.path) { setSubError(res.error || "No s'ha pogut crear l'enllaç."); return; }
    const url = `${window.location.origin}${res.path}`;
    setSubLink(url);
    addLocalApplication(concertId, memberName, "", res.path.replace("/s/", ""));
    setSubPanel({ concertId, mode: "link", phone });
  }
  // Un suplent de confiança amb compte es proposa directament; sense
  // compte, se li genera l'enllaç de sempre — i si en sabem el telèfon, el
  // botó de WhatsApp ja hi apunta directament.
  async function pickBackup(concertId: string, memberName: string, b: { name: string; clerkUserId: string; phone: string }) {
    if (b.clerkUserId) await proposeCandidate(concertId, memberName, b);
    else await makeSubLink(concertId, memberName, b.phone);
  }
  function waHref(phone: string | undefined, text: string): string {
    const digits = (phone || "").replace(/[^\d+]/g, "");
    const intl = digits ? (digits.indexOf("+") === 0 ? digits.slice(1) : "34" + digits) : "";
    return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
  }
  function subWaText(url: string, c: Concert, memberName: string) {
    return `Hola! ${memberName} no pot venir al bolo de ${band.name} el ${capitalize(formatDateFull(c.date))}${c.city ? " a " + c.city.split(",")[0] : ""} i t'ha proposat com a suplent. Presenta-t'hi aquí: ${url}`;
  }

  const sel = members.find((m) => m.name === selected) || null;
  const c1 = band.color1 || "#8b7bff";
  const c2 = band.color2 || "#5f4bcc";
  const one = single ? concerts[0] || null : null;
  // On tornar després d'entrar o crear el compte: aquí mateix, amb la
  // persona ja triada.
  const backHere = `/conf/${token}${selected ? `?sel=${encodeURIComponent(selected)}` : ""}`;

  function gateFor(m: ConfMember): Gate {
    if (!viewer.loggedIn) return m.hasAccount ? "signin" : "signup";
    if (viewer.linkedMemberName && normalize(viewer.linkedMemberName) !== normalize(m.name)) return "wrong-account";
    if (m.linked && !m.isMe) return "wrong-account";
    if (viewer.role === "manager" && !m.isMe) return "manager";
    return "table";
  }
  const gate = sel ? gateFor(sel) : null;

  // "answer" null desmarca la resposta — clicar la mateixa que ja tenies
  // marcada la dessel·lecciona (torna a "pendent").
  async function respond(concertId: string, answer: "yes" | "no" | null) {
    if (!sel || busy) return;
    const name = sel.name;
    const prev = answers[concertId]?.[name];
    setBusy(concertId);
    setError(null);
    setAnswers((a) => {
      const row = { ...(a[concertId] || {}) };
      if (answer) row[name] = answer; else delete row[name];
      return { ...a, [concertId]: row };
    });
    const res = await respondConfAction(token, concertId, name, answer);
    setBusy(null);
    if (!res.ok) {
      setError(res.error || "No s'ha pogut desar");
      setAnswers((a) => {
        const row = { ...(a[concertId] || {}) };
        if (prev) row[name] = prev; else delete row[name];
        return { ...a, [concertId]: row };
      });
      return;
    }
    router.refresh();
  }

  // Insígnia de cada membre a la llista "Qui ets?": la resposta (un sol
  // concert) o quants concerts ha respost (més d'un).
  function memberBadge(m: ConfMember): { label: string; cls: string } {
    let yes = 0, no = 0;
    concerts.forEach((c) => { const a = answers[c.id]?.[m.name]; if (a === "yes") yes++; else if (a === "no") no++; });
    if (concerts.length <= 1) {
      return yes ? { label: "Hi serà ✓", cls: "yes" } : no ? { label: "No hi serà", cls: "no" } : { label: "Pendent", cls: "pending" };
    }
    const answered = yes + no;
    if (!answered) return { label: "Pendent", cls: "pending" };
    if (answered >= concerts.length) return { label: "Tot respost ✓", cls: "yes" };
    return { label: `${answered}/${concerts.length} respostos`, cls: "pending" };
  }

  // Bloc de suplent d'una fila on s'ha dit que no: què hi ha (suplent
  // confirmat pel gestor, proposats pendents, enllaç) i el botó per
  // proposar-ne un — buscant-lo per compte o generant-li un enllaç.
  function renderSubBlock(c: Concert, memberName: string) {
    const confirmedSub = (c.substituteConfirmed || {})[memberName] ? (c.substitutes || {})[memberName] : "";
    const info = subsLocal[c.id]?.[normalize(memberName)];
    const apps = info?.applications || [];
    const panelHere = subPanel?.concertId === c.id ? subPanel : null;
    const linkUrl = info?.token ? `${window.location.origin}/s/${info.token}` : null;
    return (
      <div className="cfm-sub">
        {confirmedSub && <div className="cfm-sub-line yes">✓ Suplent confirmat pel gestor: <strong>{confirmedSub}</strong></div>}
        {apps.map((ap, i) => (
          <div key={i} className="cfm-sub-line">
            Proposat: <strong>{ap.name}</strong>
            <span className={"cfm-badge " + (ap.status === "acceptada" ? "yes" : ap.status === "rebutjada" ? "no" : "pending")}>
              {ap.status === "pendent" ? "pendent del gestor" : ap.status}
            </span>
          </div>
        ))}
        {linkUrl && !panelHere && (
          <div className="cfm-sub-line">
            Enllaç per al suplent:
            <button type="button" className="link-btn" onClick={() => { navigator.clipboard.writeText(linkUrl); setSubCopied(true); window.setTimeout(() => setSubCopied(false), 1500); }}>{subCopied ? "copiat ✓" : "copia"}</button>
            ·
            <button type="button" className="link-btn" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(subWaText(linkUrl, c, memberName))}`, "_blank")}>WhatsApp</button>
          </div>
        )}
        {!confirmedSub && !panelHere && (
          <button type="button" className="cfm-sub-btn" onClick={() => openSubPanel(c.id, memberName)}>Proposa un suplent</button>
        )}
        {panelHere && (
          <div className="cfm-sub-panel">
            {panelHere.mode === "search" && (
              <>
                <input className="field-input" type="text" placeholder="Nom del suplent…" value={subQ} onChange={(e) => setSubQ(e.target.value)} autoFocus />
                <div className="cfm-sub-results">
                  {subBackupsLoading && <div className="t-dim" style={{ fontSize: 12.5 }}>Carregant…</div>}
                  {!subBackupsLoading && filteredBackups.map((b) => (
                    <button key={b.name} type="button" className="cfm-sub-result" disabled={subBusy} onClick={() => pickBackup(c.id, memberName, b)}>
                      <span>{b.name}{b.clerkUserId && <VerifiedTick size={11} />}</span>
                      <span className="t-dim">{b.instruments.slice(0, 2).join(", ")}</span>
                    </button>
                  ))}
                  {!subBackupsLoading && subBackups.length === 0 && (
                    <div className="t-dim" style={{ fontSize: 12.5 }}>El grup encara no té cap suplent de confiança guardat.</div>
                  )}
                  {!subBackupsLoading && subBackups.length > 0 && filteredBackups.length === 0 && (
                    <div className="t-dim" style={{ fontSize: 12.5 }}>Cap suplent de confiança amb aquest nom.</div>
                  )}
                </div>
                <button type="button" className="link-btn" style={{ alignSelf: "flex-start" }} disabled={subBusy} onClick={() => makeSubLink(c.id, memberName)}>
                  {subBusy ? "Un moment…" : "+ Algú altre — genera-li un enllaç"}
                </button>
                <button type="button" className="link-btn" style={{ alignSelf: "flex-start" }} onClick={() => setSubPanel(null)}>Cancel·la</button>
              </>
            )}
            {panelHere.mode === "link" && subLink && (
              <>
                <div className="cfm-note">Envia-li aquest enllaç: s&apos;hi crearà el compte i es presentarà com a suplent; el gestor ho confirmarà.</div>
                <div className="cfm-sub-linkbox">{subLink}</div>
                <div className="cfm-gate-btns">
                  <button type="button" className="btn-outline" onClick={() => { navigator.clipboard.writeText(subLink); setSubCopied(true); window.setTimeout(() => setSubCopied(false), 1500); }}>{subCopied ? "Copiat ✓" : "Copia l'enllaç"}</button>
                  <button type="button" className="btn-outline" onClick={() => window.open(waHref(panelHere.phone, subWaText(subLink, c, memberName)), "_blank")}>WhatsApp</button>
                  <button type="button" className="link-btn" onClick={() => setSubPanel(null)}>Fet</button>
                </div>
              </>
            )}
            {subError && <div className="cfm-error">{subError}</div>}
          </div>
        )}
      </div>
    );
  }

  // Pòster del dia (mateix estil que la targeta "Proper concert" de
  // gestor), amb els 4 botons d'acció — aquí sempre només de lectura
  // (informació i full de ruta en previsualització, setlist sense poder-la
  // assignar), excepte "Comparteix", que sí que funciona de veres.
  function ConfPoster({ c, showLogo = false }: { c: Concert; showLogo?: boolean }) {
    const [rsOpen, setRsOpen] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    const [shareCopied, setShareCopied] = useState(false);
    const rs = normalizeRouteSheet(c.routeSheet as RouteSheet | null, c);
    const phases = withLiveConcertStart(rs.schedule, c.exactTime).filter((p) => p.phase && p.start);
    const concertPhase = phases.find((p) => p.phase.trim().toLowerCase() === "concert");
    const callPhase = phases.find((p) => p !== concertPhase);
    const dayFull = capitalize(formatDateFull(c.date));
    const isBolo = !c.kind || c.kind === "bolo";
    function shareText() {
      const city = (c.city || "").split(",")[0];
      return `Tot a punt per l'actuació de ${c.bandName} a ${city}. Clica a l'enllaç per veure els detalls: ${window.location.origin}/conf/${token}`;
    }
    return (
      <div className="cd-poster conf-poster">
        <div className="cd-poster-glow" aria-hidden="true"></div>
        {showLogo && band.logo && <img className="cfm-poster-logo" style={logoBox(band.logoAspect, 44)} src={band.logo} alt="" />}
        <div className="cd-poster-kicker">{c.bandName}</div>
        <div className="cd-poster-subtitle">{c.festaEntitat || (c.kind && c.kind !== "bolo" ? (c.kind === "reunio" ? "reunió" : c.kind) : "concert")}</div>
        {isBolo ? (
          <>
            {c.city && <div className="cd-poster-title">{c.city.split(",")[0]}</div>}
            {c.venue && (
              <a
                className="cd-poster-place" target="_blank" rel="noopener"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([c.venue, c.address, c.city].filter(Boolean).join(", "))}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                {c.venue}
              </a>
            )}
            <div className="cd-poster-date">{dayFull}{c.exactTime ? ` — ${c.exactTime}` : c.time ? ` — ${formatConcertTime(c.time)}` : ""}</div>
            {(callPhase || concertPhase) && (
              <div className="bento-next-sched">
                {callPhase && <div className="bento-next-sched-row"><span>{callPhase.phase}</span><b>{callPhase.start}</b></div>}
                {concertPhase && <div className="bento-next-sched-row"><span>{concertPhase.phase}</span><b>{concertPhase.start}</b></div>}
              </div>
            )}
          </>
        ) : (
          <>
            {(c.venue || c.city) && <div className="cd-poster-title">{c.venue || c.city!.split(",")[0]}</div>}
            <div className="cd-poster-date">{dayFull}</div>
            {(c.exactTime || c.time) && <div className="cd-poster-time">{c.exactTime || formatConcertTime(c.time)}</div>}
          </>
        )}
        <div className="bento-next-actions">
          <button type="button" className="btn-outline bento-next-icon-btn" title="Informació del dia"><InfoIcon /></button>
          {diaBand && <SetlistButton c={c} band={diaBand} setlists={setlists} songs={[]} canEdit={false} iconBtnClass="btn-outline bento-next-icon-btn" />}
          <button type="button" className="btn-outline bento-next-icon-btn" title="Full de ruta" onClick={() => setRsOpen(true)}><FdrIcon /></button>
          <div className="dia-share-wrap">
            <button type="button" className="btn-outline bento-next-icon-btn" title="Comparteix" onClick={() => setShareOpen((v) => !v)}><ShareIcon /></button>
            {shareOpen && (
              <div className="dia-share-menu">
                <button
                  type="button" className="dia-share-menu-item"
                  onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/conf/${token}`); setShareCopied(true); setShareOpen(false); window.setTimeout(() => setShareCopied(false), 1500); }}
                >{shareCopied ? "Copiat ✓" : "Copia l'enllaç"}</button>
                <button
                  type="button" className="dia-share-menu-item"
                  onClick={() => { window.open(`https://wa.me/?text=${encodeURIComponent(shareText())}`, "_blank"); setShareOpen(false); }}
                >WhatsApp</button>
              </div>
            )}
          </div>
        </div>
        {rsOpen && <RouteSheetPreview concert={c} onClose={() => setRsOpen(false)} onEdit={() => {}} />}
      </div>
    );
  }

  // Assistència del dia en format llista (nom, foto, instruments, si ve o
  // no, i el suplent si n'hi ha) — primer bloc dels "Detalls del dia",
  // abans de la resta d'informació (horaris, contactes...) de DiaBody.
  function renderAttendanceList(c: Concert) {
    return (
      <div className="dia-card">
        <div className="dia-card-title">Assistència</div>
        <div className="cfm-att-list">
          {members.map((m) => {
            const a = (c.attendance || {})[m.name];
            const subName = a === "no" ? (c.substitutes || {})[m.name] : "";
            return (
              <div key={m.name} className={"cd-att-row" + (a === "yes" ? " att-yes" : a === "no" ? " att-no" : "")}>
                <img className="member-photo" src={m.photoId ? `/api/file/${m.photoId}` : personPhotoDataUri(m.name)} alt="" />
                <div className="cd-att-main">
                  <div className="member-name">{m.name}{m.linked && <VerifiedTick size={12} />}</div>
                  {m.instruments.length > 0 && (
                    <div className="member-instruments">
                      {m.instruments.slice(0, 3).map((ins) => <span key={ins} className="member-instrument-chip">{ins}</span>)}
                    </div>
                  )}
                  {subName && <div className="cfm-sub-line yes" style={{ marginTop: 2 }}>Suplent: <strong>{subName}</strong></div>}
                </div>
                <span className={"cfm-badge " + (a === "yes" ? "yes" : a === "no" ? "no" : "pending")}>
                  {a === "yes" ? "Hi serà" : a === "no" ? "No hi serà" : "Pendent"}
                </span>
              </div>
            );
          })}
          {members.length === 0 && <span className="t-dim" style={{ fontSize: 13 }}>Sense formació assignada.</span>}
        </div>
      </div>
    );
  }

  const firstName = sel ? sel.name.split(" ")[0] : "";

  return (
    <div className="cfm-page" style={{ ["--c1" as string]: c1, ["--c2" as string]: c2, ["--band-accent" as string]: c1 }}>
      <div className="cfm-card">
        {one ? (
          <ConfPoster c={one} showLogo />
        ) : (
          <div className="cfm-band-head">
            {band.logo && <img style={logoBox(band.logoAspect, 64)} src={band.logo} alt="" />}
            <div className="cfm-band-kicker">{band.name}</div>
            <div className="cfm-band-title">Propers concerts</div>
            <div className="cfm-band-sub">
              {concerts.length === 0 ? "Cap concert proper" : `${concerts.length} ${concerts.length === 1 ? "concert" : "concerts"}`}
              {allFuture ? " · tots els propers del grup" : ""}
            </div>
          </div>
        )}

        {one && (
          <div className="dia" style={{ padding: 0, margin: 0, maxWidth: "none" }}>
            {renderAttendanceList(one)}
            <DiaBody concert={one} band={diaBand} linkedNames={linkedNames} hideQuiVe />
          </div>
        )}

        {!sel ? (
          <>
            <div className="cfm-question">Qui ets? Marca&apos;t per confirmar la teva assistència.</div>
            <div className="cfm-members">
              {members.map((m) => {
                const badge = memberBadge(m);
                return (
                  <button
                    key={m.name} type="button"
                    className={"cfm-member" + (m.isMe ? " me" : "")}
                    onClick={() => { setSelected(m.name); setError(null); }}
                  >
                    <img src={m.photoId ? `/api/file/${m.photoId}` : personPhotoDataUri(m.name)} alt="" />
                    <span className="cfm-member-main">
                      <span className="cfm-member-name">{m.name}{m.isMe ? " (tu)" : ""}{m.linked && <VerifiedTick size={12} />}</span>
                      {m.instruments.length > 0 && <span className="cfm-member-ins">{m.instruments.slice(0, 2).join(", ")}</span>}
                    </span>
                    <span className={"cfm-badge " + badge.cls}>{badge.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="cfm-identity">
              <img src={sel.photoId ? `/api/file/${sel.photoId}` : personPhotoDataUri(sel.name)} alt="" />
              <div className="cfm-identity-main">
                <div className="cfm-identity-name">{sel.name}{sel.isMe ? " (tu)" : ""}{sel.linked && <VerifiedTick size={12} />}</div>
                {sel.instruments.length > 0 && <div className="cfm-identity-sub">{sel.instruments.slice(0, 2).join(", ")}</div>}
              </div>
              {!sel.isMe && (
                <button type="button" className="link-btn" onClick={() => { setSelected(""); setError(null); }}>No ets tu? Canvia</button>
              )}
            </div>

            {gate === "signin" && (
              <div className="cfm-panel">
                <div className="cfm-note">
                  <strong>{firstName}</strong>, ja tens un compte d&apos;Escenari. Entra-hi per confirmar la teva assistència —
                  així la resposta queda lligada a tu i la veuràs també a la teva agenda.
                </div>
                <div className="cfm-gate-btns">
                  <Link className="btn-primary" href={`/sign-in?redirect_url=${encodeURIComponent(backHere)}`}>Inicia sessió</Link>
                </div>
              </div>
            )}

            {gate === "signup" && (
              <div className="cfm-panel">
                <div className="cfm-note">
                  Per confirmar cal un compte d&apos;Escenari — te&apos;l crees en un moment (només correu i contrasenya) i
                  quedaràs vinculat/da a <strong>{band.name}</strong> com a <strong>{sel.name}</strong>. A partir d&apos;aquí
                  podràs confirmar cada bolo des de la teva agenda.
                </div>
                <div className="cfm-gate-btns">
                  <Link className="btn-primary" href={`/sign-up?redirect_url=${encodeURIComponent(backHere)}`}>Crea un compte</Link>
                  <Link className="btn-outline" href={`/sign-in?redirect_url=${encodeURIComponent(backHere)}`}>Ja tinc compte</Link>
                </div>
              </div>
            )}

            {gate === "wrong-account" && (
              <div className="cfm-panel">
                <div className="cfm-note">
                  {viewer.linkedMemberName
                    ? <>El compte amb què has entrat està vinculat a <strong>{viewer.linkedMemberName}</strong> en aquest grup — no pot respondre per {sel.name}.</>
                    : <><strong>{sel.name}</strong> ja té el compte vinculat — només pot confirmar la mateixa persona, amb el seu compte.</>}
                </div>
                <div className="cfm-gate-btns">
                  <SignOutButton redirectUrl={backHere}>
                    <button type="button" className="btn-outline">Tanca sessió i entra amb un altre compte</button>
                  </SignOutButton>
                  <button type="button" className="link-btn" onClick={() => { setSelected(""); setError(null); }}>Tria una altra persona</button>
                </div>
              </div>
            )}

            {gate === "manager" && (
              <div className="cfm-panel">
                <div className="cfm-note">
                  Estàs amb el compte de <strong>gestor</strong> — aquest enllaç és perquè cada músic respongui amb el seu compte.
                  Marca l&apos;assistència des de la fitxa del concert a Escenari.
                </div>
              </div>
            )}

            {gate === "table" && (
              <div className="cfm-table">
                <div className="cfm-table-head">
                  <span>{concerts.length === 1 ? "Hi seràs?" : `${concerts.length} concerts — marca si hi seràs a cadascun`}</span>
                  {allFuture && <span>tots els propers del grup</span>}
                </div>
                {concerts.length === 0 && <div className="cfm-note">Ara mateix no hi ha cap concert proper per confirmar.</div>}
                {concerts.map((c) => {
                  const a = answers[c.id]?.[sel.name] || "";
                  const k = kindOf(c);
                  const km = KIND_META[k];
                  // El títol de l'esdeveniment ja surt a la bombolla del tipus
                  // — si coincideix ("Assaig"), no el repeteixis al subtítol.
                  const festa = c.festaEntitat && normalize(c.festaEntitat) !== normalize(km.label) ? c.festaEntitat : "";
                  const sub = [festa, c.venue, c.city ? c.city.split(",")[0] : ""].filter(Boolean).join(" · ");
                  // Resum d'assistència de tot el grup per a aquest concert:
                  // el de tothom ve dels concerts (ja al dia amb el darrer
                  // router.refresh()), amb la teva pròpia resposta al damunt
                  // perquè es vegi a l'instant encara que no hagi arribat.
                  const attMap: Record<string, string> = { ...(c.attendance || {}) };
                  if (a) attMap[sel.name] = a; else delete attMap[sel.name];
                  const attTotal = members.length;
                  const attYes = members.filter((m) => attMap[m.name] === "yes").length;
                  const attNo = members.filter((m) => attMap[m.name] === "no").length;
                  const attYesPct = attTotal ? (attYes / attTotal) * 100 : 0;
                  const attNoPct = attTotal ? (attNo / attTotal) * 100 : 0;
                  const showButtons = !a;
                  return (
                    <div key={c.id} className={"cfm-row" + (a ? " " + a : "")} style={{ borderLeft: `4px solid ${km.color}` }}>
                      <div className="cfm-row-main">
                        <div className="cfm-row-date">
                          {single ? capitalize(formatDateFull(c.date)) : capitalize(rowDate(c.date))}
                          {c.exactTime ? (
                            <> · {c.exactTime}</>
                          ) : c.time ? (
                            <> · <TimePeriodIcon period={timePeriodFor(c.time) || "Matinada"} /> {formatConcertTime(c.time)}</>
                          ) : null}
                        </div>
                        <div className="cfm-row-kind-sub">
                          <span className="cc-kind" style={{ background: km.bg, color: km.color }}>{km.label}</span>
                          {sub && <span className="cfm-row-sub">{sub}</span>}
                        </div>
                      </div>
                      {showButtons ? (
                        <div className="cfm-row-btns">
                          <button type="button" className={"cfm-row-btn icon yes" + (a === "yes" ? " active" : "")} title={a === "yes" ? "Hi seré — toca per treure la resposta" : "Hi seré"} disabled={busy === c.id} onClick={() => respond(c.id, a === "yes" ? null : "yes")}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          </button>
                          <button type="button" className={"cfm-row-btn icon no" + (a === "no" ? " active" : "")} title={a === "no" ? "No hi seré — toca per treure la resposta" : "No hi seré"} disabled={busy === c.id} onClick={() => respond(c.id, a === "no" ? null : "no")}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                          </button>
                        </div>
                      ) : (
                        <div className="cc-att" style={{ cursor: "pointer" }} title="Toca per treure la teva resposta"
                          onClick={(e) => { e.stopPropagation(); respond(c.id, null); }}>
                          <div className="cc-att-track">
                            <div className="cc-att-fill" style={{ width: attYesPct + "%", background: "oklch(0.72 0.15 155)" }}></div>
                            <div className="cc-att-fill" style={{ width: attNoPct + "%", background: "var(--red)" }}></div>
                          </div>
                          <div className="cc-att-count">{attYes}/{attTotal}</div>
                        </div>
                      )}
                      {a === "no" && renderSubBlock(c, sel.name)}
                      {!single && (
                        <button type="button" className="cfm-row-expand" onClick={() => setExpanded((p) => ({ ...p, [c.id]: !p[c.id] }))}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: expanded[c.id] ? "rotate(180deg)" : "none" }}><polyline points="6 9 12 15 18 9"></polyline></svg>
                          {expanded[c.id] ? "Amaga els detalls" : "Detalls del dia"}
                        </button>
                      )}
                      {!single && expanded[c.id] && (
                        <div className="cfm-row-details dia">
                          {renderAttendanceList(c)}
                        </div>
                      )}
                    </div>
                  );
                })}
                {error && <div className="cfm-error">{error}</div>}
              </div>
            )}
          </>
        )}

        <div className="cfm-footer">
          <img className="brand-mark" src="/logo-mark.png" alt="" />
          <span className="brand-name">ESCENARI</span>
        </div>
      </div>
    </div>
  );
}
