"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Band, Concert, Invoice, CompanyInfo, ClientDetails, Contact } from "@/lib/types";
import { formatCurrency, formatDate, formatDateFull, formatDateLong, capitalize, statusColors, pad2, formatConcertTime, formatConcertTimePhrase } from "@/lib/format";
import { bandColor, personPhotoDataUri, instrumentsFor, instrumentIconFor } from "@/lib/tags";
import { rsCompletionPercent, withLiveAddress, withLiveConcertStart, type RouteSheet } from "@/lib/route-sheet";
import { normalize } from "@/lib/text";
import type { LinkedMember, BackupRequest } from "@/lib/group-data";
import type { Rider, Setlist, RiderApproval } from "@/lib/material-types";
import type { ShareLink } from "@/lib/share-data";
import { setConcertMaterialAction, sendRiderApprovalAction, acceptCounterRiderAction, deleteRiderApprovalAction } from "@/app/(app)/grup/material-actions";
import { sendApprovalEmailAction } from "@/app/a/actions";
import SpecularButton from "@/components/SpecularButton";
import { shareLinkStatus } from "@/lib/share-data";
import { saveConcertAction, savePayoutsAction, setInvoiceStateAction, setConcertKindAction, nudgeAttendanceAction, setAgencyPctAction, repeatConcertAction, setSetlistHighlightsAction, deleteConcertAction } from "@/app/(app)/concerts/actions";
import { editInvoiceAction, sendInvoiceReminderAction } from "@/app/(app)/facturacio/actions";
import { computeInvoiceTotals } from "@/lib/invoice-utils";
import { generateInvoiceAction } from "@/app/(app)/facturacio/actions";
import { upsertClientDetailsAction } from "@/app/(app)/base-de-dades/actions";
import { createShareLinkAction, revokeShareLinkAction, sendShareLinkEmailAction } from "@/app/(app)/concerts/share-actions";
import { createAttendanceLinkAction, listAttendanceLinkConcertsAction } from "@/app/conf/actions";
import AttendanceLinkModal, { type AttendanceLinkIntent } from "@/components/AttendanceLinkModal";
import type { AttendanceLinkConcert } from "@/app/conf/actions";
import { publishBackupRequestAction, setBackupRequestStatusAction, saveDefaultPayoutSplitAction, respondBackupApplicationAction } from "@/app/(app)/grup/actions";
import { EXPENSE_PAYER_LABELS, type Transaction, type ExpensePayer } from "@/lib/finance";
import { saveTransactionAction, deleteTransactionAction, setTransactionPayerAction } from "@/app/(app)/estadistiques/finance-actions";
import RouteSheetEditor from "@/components/RouteSheetEditor";
import FoldPanel from "@/components/FoldPanel";
import ContractPanel from "@/components/ContractPanel";
import PlanLock from "@/components/PlanLock";
import type { BillingInfo } from "@/lib/plans";
import RouteSheetPreview from "@/components/RouteSheetPreview";
import InvoicePreview from "@/components/InvoicePreview";
import ConcertPosterModal from "@/components/ConcertPosterModal";
import InlineDatePicker from "@/components/InlineDatePicker";
import VenueSearchField, { resolvePlaceToVenueFields } from "@/components/VenueSearchField";
import { KIND_META } from "@/components/CalendariView";
import TimePeriodBubble from "@/components/TimePeriodBubble";
import ContactAutocomplete from "@/components/ContactAutocomplete";
import VerifiedTick from "@/components/VerifiedTick";
import ConfirmDialog from "@/components/ConfirmDialog";
import BackLink from "@/components/BackLink";

const STATUS_CYCLE = ["pendent", "reservat", "confirmat", "cancel·lat"];

// Mateixa escala que el ConcertModal: vermell → groc → verd.
function progressColor(percent: number, alpha = 1): string {
  let l: number, c: number, h: number;
  if (percent < 15) { l = 0.62; c = 0.19; h = 25; }
  else if (percent < 80) { l = 0.8; c = 0.15; h = 90; }
  else {
    const t = (percent - 80) / 20;
    h = 90 + (145 - 90) * t;
    c = 0.15 + (0.19 - 0.15) * t;
    l = 0.8 + (0.7 - 0.8) * t;
  }
  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)} / ${alpha})`;
}

// Percentatge d'informació bàsica del concert (per al mesurador "què falta").
// "amountFilled" ve a part perquè "0 € (de veres)" i "encara buit" tots dos
// es guarden com el mateix 0 numèric — només l'estat local de l'input (un
// text, no un número) sap distingir-los mentre s'edita.
export function infoCompletion(c: Concert, opts?: { amountFilled?: boolean }): { percent: number; missing: string[] } {
  const checks: [string, boolean][] = [
    ["Data", !!c.date],
    ["Hora", !!c.exactTime],
    ["Adreça", !!c.address.trim()],
    ["Recinte", !!c.venue.trim() && c.venue !== "Sala per determinar"],
    ["Festa/entitat", !!(c.festaEntitat || "").trim()],
    // No es demanen aquests tres camps als assajos/reunions/altres — no els
    // hi surten (ni tan sols la casella).
    ["Import", c.kind && c.kind !== "bolo" ? true : (opts?.amountFilled ?? c.amount > 0)],
    ["Es pot anunciar?", c.kind && c.kind !== "bolo" ? true : !!c.canAnnounce],
    ["Tipus d'entrada", c.kind && c.kind !== "bolo" ? true : !!c.ticketType],
    // Un cancel·lat ja no necessita arribar a "confirmat" — és igualment un
    // estat resolt/definitiu, no un pendent de decidir.
    ["Estat confirmat", c.status === "confirmat" || c.status === "cancel·lat"],
  ];
  const filled = checks.filter(([, ok]) => ok).length;
  return { percent: Math.round((filled / checks.length) * 100), missing: checks.filter(([, ok]) => !ok).map(([label]) => label) };
}


// Mesurador del bànner (Informació, Full de ruta): en passar-hi el ratolí
// surt què falta amb el mateix format de bombolles que el d'Assistència, i
// clicar-lo porta a la pestanya corresponent.
function Meter({ label, percent, missing, onClick }: { label: string; percent: number; missing: string[]; onClick?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={"cd-meter" + (onClick ? " clickable" : "")} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} aria-label={onClick ? `${label}: ${percent}% — obre la pestanya` : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
    >
      <div className="cd-meter-head">
        <span>{label}</span>
        <span style={{ color: progressColor(percent) }}>{percent}%</span>
      </div>
      <div className="cd-meter-track">
        <div className="cd-meter-fill" style={{ width: percent + "%", background: progressColor(percent) }}></div>
      </div>
      {open && (
        <div className="cd-meter-tip">
          <div className="cd-meter-tip-title">{missing.length ? "Falta:" : label + ":"}</div>
          <div className="cd-att-bubbles">
            {missing.length
              ? missing.map((m) => <span key={m} className="cd-att-bubble pending"><HourglassIcon />{m}</span>)
              : <span className="cd-att-bubble yes">✓ Tot complet</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function WarnIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>;
}
function SwapIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-1px", flex: "none" }}>
      <path d="m21 16-4 4-4-4"></path>
      <path d="M17 20V4"></path>
      <path d="m3 8 4-4 4 4"></path>
      <path d="M7 4v16"></path>
    </svg>
  );
}
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

// Barra de la convocatòria a la capçalera: en comptes d'un sol percentatge,
// dos trams (sí en verd, no en vermell) sobre el total de membres — el
// tram restant (sense marcar) es veu com a fons neutre. Els exclosos de la
// convocatòria d'aquest concert no compten enlloc (ni al total).
function AttendanceMeter({ people, attendance, excluded, substitutes = {}, onClick }: { people: { name: string }[]; attendance: Record<string, string>; excluded: Record<string, boolean>; substitutes?: Record<string, string>; onClick?: () => void }) {
  const [open, setOpen] = useState(false);
  const active = people.filter((p) => !excluded[p.name]);
  const yes = active.filter((p) => attendance[p.name] === "yes");
  const no = active.filter((p) => attendance[p.name] === "no");
  const total = active.length;
  const yesPct = total ? (yes.length / total) * 100 : 0;
  const noPct = total ? (no.length / total) * 100 : 0;
  const pending = active.filter((p) => attendance[p.name] !== "yes" && attendance[p.name] !== "no");
  return (
    <div
      className={"cd-meter" + (onClick ? " clickable" : "")} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} aria-label={onClick ? "Assistència — obre la convocatòria" : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
    >
      <div className="cd-meter-head">
        <span>Assistència</span>
        <span>
          <span style={{ color: "oklch(0.72 0.15 155)" }}>{yes.length} sí</span>
          {no.length > 0 && <span style={{ color: "var(--red)" }}> · {no.length} no</span>}
          {yes.length === 0 && no.length === 0 && <span className="t-dim"> —</span>}
        </span>
      </div>
      <div className="cd-meter-track cd-att-meter-track">
        <div className="cd-meter-fill" style={{ width: yesPct + "%", background: "oklch(0.72 0.15 155)" }}></div>
        <div className="cd-meter-fill" style={{ width: noPct + "%", background: "var(--red)" }}></div>
      </div>
      {open && total > 0 && (
        <div className="cd-meter-tip">
          <div className="cd-meter-tip-title">Assistència:</div>
          <div className="cd-att-bubbles">
            {yes.map((p) => <span key={p.name} className="cd-att-bubble yes">✓ {p.name}</span>)}
            {no.map((p) => {
              const sub = substitutes[p.name];
              return (
                <span key={p.name} className="cd-att-bubble-group">
                  <span className="cd-att-bubble no" style={sub ? { textDecoration: "line-through" } : undefined}>✕ {p.name}</span>
                  {sub && <span className="cd-att-bubble sub"><SwapIcon />{sub}</span>}
                </span>
              );
            })}
            {pending.map((p) => (
              <span key={p.name} className="cd-att-bubble pending"><HourglassIcon />{p.name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function rsMissingList(c: Concert): string[] {
  const rs = c.routeSheet as {
    lloc?: { label: string; value: string }[]; contacts?: { name: string }[];
    schedule?: { phase: string; start: string; end: string }[];
    hospitalitat?: { label: string; value: string; included?: boolean }[];
    tecnic?: { label: string; value: string; included?: boolean; status?: string }[];
  } | null;
  if (!rs) return ["Tot el full de ruta"];
  const missing: string[] = [];
  withLiveAddress(rs.lloc, c.address).forEach((it) => { if (it.label && !String(it.value || "").trim()) missing.push(it.label); });
  if (!(rs.contacts || []).some((ct) => ct.name && ct.name.trim())) missing.push("Contactes");
  withLiveConcertStart(rs.schedule, c.exactTime).forEach((it) => { if (it.phase && (!it.start || !it.end)) missing.push("Horari: " + it.phase); });
  // Un "sí"/"no" ja marcat, o un contrarider "aprovat", ja compten com a fets
  // encara que no s'hi hagi escrit cap detall — mateix criteri que la barra
  // de progrés, perquè aquesta llista de "què falta" no li contradigui.
  (rs.hospitalitat || []).forEach((it) => {
    const done = !!(it.value && String(it.value).trim()) || it.included !== undefined;
    if (it.label && !done) missing.push(it.label);
  });
  (rs.tecnic || []).forEach((it) => {
    if (!it.label) return;
    const label = it.label.trim().toLowerCase();
    if (label === "pantalla led") { if (it.included === undefined) missing.push(it.label); return; }
    const done = !!(it.value && String(it.value).trim()) || (label === "contra rider" && it.status === "aprovat");
    if (!done) missing.push(it.label);
  });
  return missing;
}

// Cerca de suplent oberta d'un membre: d'on ve (borsa o enllaç de
// confirmació), l'enllaç del suplent proposat (per copiar-lo) i les
// candidatures, que el gestor accepta o rebutja aquí mateix — en acceptar,
// la persona passa a suplent d'aquest concert i a suplent de confiança.
function SubRequestBox({ req, onDecided, onWithdraw }: {
  req: BackupRequest;
  onDecided: (app: BackupRequest["applications"][number], status: "acceptada" | "rebutjada") => void;
  onWithdraw: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  async function decide(app: BackupRequest["applications"][number], status: "acceptada" | "rebutjada") {
    setBusy(app.clerkUserId + status);
    await respondBackupApplicationAction(req.id, app.clerkUserId, status);
    setBusy(null);
    onDecided(app, status);
  }
  const n = req.applications.length;
  return (
    <div className="cd-sub-box">
      <span className="cd-search-open">
        {req.proposedBy ? "Suplent proposat des de l'enllaç de confirmació" : "Cerca publicada"} · {n} {n === 1 ? "candidatura" : "candidatures"}
        {req.token && (
          <button type="button" className="link-btn" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/s/${req.token}`); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }}>
            {copied ? "enllaç copiat ✓" : "copia l'enllaç del suplent"}
          </button>
        )}
        <button type="button" className="link-btn" onClick={onWithdraw}>retira</button>
      </span>
      {n > 0 && (
        <div className="cd-sub-apps">
          {req.applications.map((a) => (
            <div key={a.clerkUserId} className="cd-sub-app">
              <span className="cd-sub-app-name">
                {a.name}<VerifiedTick size={11} />
                {a.instruments.length > 0 && <span className="t-dim"> · {a.instruments.slice(0, 2).join(", ")}</span>}
              </span>
              {a.message && <span className="cd-sub-app-msg t-dim">&ldquo;{a.message}&rdquo;</span>}
              {a.status === "pendent" ? (
                <span className="cd-sub-app-actions">
                  <button type="button" className="btn-save" disabled={!!busy} onClick={() => decide(a, "acceptada")}>{busy === a.clerkUserId + "acceptada" ? "…" : "Accepta"}</button>
                  <button type="button" className="btn-outline" disabled={!!busy} onClick={() => decide(a, "rebutjada")}>Rebutja</button>
                </span>
              ) : (
                <span className={"cfm-badge " + (a.status === "acceptada" ? "yes" : "no")}>{a.status}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const AGENCY_PAYOUT_NAME = "Agència";

// Qui paga cada despesa — les d'abans d'existir el camp (sense "paidBy")
// segueixen el criteri antic del concert: "tots dos" si l'agència assumia
// despeses, "grup" si no.
function expensePayer(t: Transaction, legacyAgencyAssumes: boolean): ExpensePayer {
  const p = t.paidBy;
  if (p === "agencia" || p === "grup" || p === "ambdos" || p === "altre") return p;
  return legacyAgencyAssumes ? "ambdos" : "grup";
}
function splitExpenses(list: Transaction[], legacyAgencyAssumes: boolean): Record<ExpensePayer, number> {
  const out: Record<ExpensePayer, number> = { agencia: 0, grup: 0, ambdos: 0, altre: 0 };
  list.forEach((t) => { out[expensePayer(t, legacyAgencyAssumes)] += t.amount; });
  return out;
}
const EXPENSE_PAYER_KEYS = Object.keys(EXPENSE_PAYER_LABELS) as ExpensePayer[];
// Els imports del repartiment es mouen en cèntims per dins (nombres
// enters), perquè un repartiment entre 3 persones (33,33 / 33,33 / 33,34)
// no arrossegui errors d'arrodoniment de coma flotant — es converteixen a
// € (amb 2 decimals) només en entrar/sortir.
function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
function toCents(x: number): number {
  return Math.round(x * 100);
}
// Repartiment predeterminat de fàbrica (quan no n'hi ha cap de desat ni de
// personalitzat pel grup): l'agència s'emporta sempre un 20% fix i la resta
// es reparteix a parts iguals entre tothom més.
const AGENCY_DEFAULT_PCT = 20;
// Gràfica circular única amb tot el repartiment (un sector per persona), en
// comptes de la barra horitzontal d'abans o d'un anell per fila.
function PayoutDonut({ segments }: { segments: { color: string; pct: number; label: string }[] }) {
  const r = 40, c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width="110" height="110" viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="16" />
      {segments.map((s, i) => {
        if (s.pct <= 0) return null;
        const dash = (Math.min(100, s.pct) / 100) * c;
        const seg = (
          <circle
            key={i} cx="50" cy="50" r={r} fill="none" stroke={s.color} strokeWidth="16"
            strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset}
            transform="rotate(-90 50 50)"
          >
            <title>{s.label}: {Math.round(s.pct)}%</title>
          </circle>
        );
        offset += dash;
        return seg;
      })}
    </svg>
  );
}
// "pool" és els diners de veres a repartir (el net); "agencyBasis" és sobre
// què es calcula el tall de l'agència (el mateix net, o el brut si no
// assumeix despeses) — quan difereixen, la resta absorbeix la diferència.
function agencyDefaultSplit(otherNames: string[], pool: number, agencyBasis: number = pool): Record<string, number> {
  const out: Record<string, number> = {};
  const agencyCents = Math.round((AGENCY_DEFAULT_PCT / 100) * toCents(agencyBasis));
  out[AGENCY_PAYOUT_NAME] = agencyCents / 100;
  const restCents = toCents(pool) - agencyCents;
  if (otherNames.length) {
    const per = Math.floor(restCents / otherNames.length);
    otherNames.forEach((n, i) => { out[n] = (per + (i === 0 ? restCents - per * otherNames.length : 0)) / 100; });
  }
  return out;
}

export default function ConcertDetailView({
  concert, band, bands, invoice, companyInfo, clientDetails, contacts = [], linkedMembers, shareLinks, backupRequests, riders, setlists, riderApprovals, clashes, venueHistory, concertExpenses: expenseList, emailReady, photosByName = {}, today, managerName,
  billing, activeLinks, canUpgrade = true,
}: {
  concert: Concert;
  band: Band | null;
  bands: Band[];
  invoice: Invoice | null;
  companyInfo: CompanyInfo;
  clientDetails: Record<string, ClientDetails>;
  contacts?: Contact[];
  linkedMembers: LinkedMember[];
  shareLinks: ShareLink[];
  backupRequests: BackupRequest[];
  riders: Rider[];
  setlists: Setlist[];
  riderApprovals: RiderApproval[];
  clashes: string[];
  venueHistory: { date: string; amount: number; invoiceState: string | null; daysToPay: number | null }[];
  concertExpenses: Transaction[];
  emailReady: boolean;
  photosByName?: Record<string, string>; // nom normalitzat → id de fitxer de foto
  today: string;
  managerName: string;
  // Pla del workspace: què està bloquejat (contractes, factures, enllaços).
  billing: BillingInfo;
  activeLinks: { count: number; cap: number | null; reached: boolean };
  canUpgrade?: boolean;
}) {
  const router = useRouter();
  const [cf, setCf] = useState({
    date: concert.date, time: concert.time, exactTime: concert.exactTime || "", venue: concert.venue, city: concert.city,
    address: concert.address || "",
    festaEntitat: concert.festaEntitat || "", amount: concert.amount > 0 ? String(concert.amount) : "", status: concert.status as string,
    canAnnounce: concert.canAnnounce || "", announceAfter: concert.announceAfter || "",
    ticketType: concert.ticketType || "",
  });
  const [attendance, setAttendance] = useState<Record<string, string>>({ ...(concert.attendance || {}) });
  const [substitutes, setSubstitutes] = useState<Record<string, string>>({ ...(concert.substitutes || {}) });
  const [noSubstitute, setNoSubstitute] = useState<Record<string, boolean>>({ ...(concert.noSubstitute || {}) });
  // Membres exclosos de la convocatòria d'aquest concert (name -> true):
  // no s'eliminen del grup, es desactiven només per a aquest bolo.
  const [convocatoriaExcluded, setConvocatoriaExcluded] = useState<Record<string, boolean>>({ ...(concert.convocatoriaExcluded || {}) });
  // Contacte principal d'aquest concert (organitzador/promotor).
  const [contact, setContact] = useState<Concert["contact"]>({ ...(concert.contact || { email: "", name: "", phone: "", company: "" }) });
  // Còpia en directe del full de ruta (el manté RouteSheetEditor, aquí només
  // se'n rep un eco) perquè la barra de progrés del bànner i el "què falta"
  // s'actualitzin a l'instant en editar-lo, sense esperar el desat+refresc.
  const [liveRs, setLiveRs] = useState<RouteSheet | null>(null);
  // Avís que l'Adreça d'Informació s'ha omplert sola en triar un recinte —
  // desapareix en el moment que s'edita a mà.
  const [addressAutofilled, setAddressAutofilled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nudging, setNudging] = useState(false);
  const [nudgeResult, setNudgeResult] = useState<string | null>(null);
  const [kind, setKind] = useState<string>(concert.kind || "bolo");
  // Repetició d'assajos: no és cap dada del concert (cada ocurrència creada
  // és un concert independent i propi), és només l'acció puntual de
  // generar-los fins a la data triada.
  const [repeatFreq, setRepeatFreq] = useState<"cap" | "setmanal" | "quinzenal" | "mensual">("cap");
  const [repeatUntil, setRepeatUntil] = useState("");
  const [repeating, setRepeating] = useState(false);
  const [repeatResult, setRepeatResult] = useState<string | null>(null);
  // Mateix càlcul que repeatConcertAction (servidor) però només per pintar
  // al calendari quins dies caurien a la repetició — l'acció real de crear-
  // los és sempre la del servidor, això és només la previsualització.
  const repeatOccurrences = useMemo(() => {
    if (repeatFreq === "cap") return undefined;
    const p = cf.date.split("-").map(Number);
    const set = new Set<string>();
    for (let i = 1; i <= 104; i++) {
      const d = repeatFreq === "mensual"
        ? new Date(p[0], p[1] - 1 + i, p[2])
        : new Date(p[0], p[1] - 1, p[2] + i * (repeatFreq === "quinzenal" ? 14 : 7));
      set.add(d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()));
    }
    return set;
  }, [cf.date, repeatFreq]);
  const REPEAT_KIND_PLURAL: Record<string, string> = { assaig: "assajos", reunio: "reunions", altre: "esdeveniments" };
  // Triar el dia de "Fins al dia" ja dispara la repetició tota sola (com la
  // resta del panell, que es desa sol) — no cal cap botó a part per confirmar.
  async function handleRepeat(untilDate: string) {
    if (repeatFreq === "cap" || !untilDate) return;
    setRepeating(true);
    const { created } = await repeatConcertAction(concert.id, repeatFreq, untilDate);
    setRepeating(false);
    setRepeatResult(created > 0 ? `${created} ${REPEAT_KIND_PLURAL[kind] || "esdeveniments"} creats ✓` : "Cap de nou (data massa a prop?)");
    window.setTimeout(() => setRepeatResult(null), 3000);
    if (created > 0) router.refresh();
  }
  const [rsPreviewOpen, setRsPreviewOpen] = useState(false);
  const [invoicePreviewOpen, setInvoicePreviewOpen] = useState(false);
  const [posterOpen, setPosterOpen] = useState(false);
  const [tab, setTab] = useState<"info" | "assistencia" | "ruta" | "facturacio">("info");
  const [generating, setGenerating] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const refreshTimer = useRef<number | null>(null);
  // Última versió de "cf", sempre al dia — cal per als llocs que combinen
  // "cf" amb una resolució asíncrona (cerca de recinte/allotjament): si
  // s'agafés "cf" directament (capturat en el moment de cridar la funció),
  // un canvi fet mentre la cerca encara està en curs (per exemple la data)
  // es perdria en tornar i re-escriure tot "cf" amb la versió antiga.
  const cfRef = useRef(cf);
  useEffect(() => { cfRef.current = cf; }, [cf]);

  // ---- Compartir ----
  const [newLinkOpen, setNewLinkOpen] = useState(false);
  const [linkScope, setLinkScope] = useState<"info" | "ruta" | "both">("both");
  const [linkEmail, setLinkEmail] = useState("");
  const [linkName, setLinkName] = useState("");
  const [linkDays, setLinkDays] = useState(14);
  const [creatingLink, setCreatingLink] = useState(false);
  const [lastCreatedUrl, setLastCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<Record<string, string>>({});

  // ---- Despeses ----
  // Cada despesa diu qui la paga: l'agència (surt de la seva comissió), el
  // grup (del que es reparteixen músics i crew), tots dos (redueix el caixet
  // abans de calcular res — el % de l'agència s'aplica al net) o altres (el
  // promotor, la sala... — no és cap cost del bolo).
  const agencyAssumesExpenses = concert.agencyAssumesExpenses !== false; // criteri antic per a les despeses sense "paidBy"
  const [expenseForm, setExpenseForm] = useState<{ title: string; amount: string; payer: ExpensePayer }>({ title: "", amount: "", payer: "ambdos" });
  const [expenseSaving, setExpenseSaving] = useState(false);
  const expenseSplit = splitExpenses(expenseList, agencyAssumesExpenses);
  // Cost real del bolo: tot menys el que paga algú altre.
  const totalExpenses = expenseSplit.agencia + expenseSplit.grup + expenseSplit.ambdos;
  async function addExpense() {
    const amount = parseInt(expenseForm.amount, 10) || 0;
    if (!amount || !expenseForm.title.trim()) return;
    setExpenseSaving(true);
    await saveTransactionAction({
      id: null, kind: "despesa", category: expenseForm.title.trim(), amount, date: concert.date,
      concertId: concert.id, member: "", fund: "", notes: "", paidBy: expenseForm.payer,
    });
    setExpenseForm({ title: "", amount: "", payer: expenseForm.payer });
    router.refresh();
    setExpenseSaving(false);
  }
  async function removeExpense(id: string) {
    await deleteTransactionAction(id);
    router.refresh();
  }
  async function changeExpensePayer(id: string, payer: ExpensePayer) {
    await setTransactionPayerAction(id, payer);
    router.refresh();
  }

  // El % de l'agència es guarda fix (no derivat de l'import): si canvien
  // les despeses o el caixet, només varia l'import en €, mai el %.
  const [agencyPct, setAgencyPct] = useState(concert.agencyPct ?? AGENCY_DEFAULT_PCT);

  // ---- Pagaments ----
  // Si el concert encara no té cap repartiment desat, s'omple amb els
  // percentatges predeterminats del grup (si n'hi ha) escalats al caixet
  // NET d'aquest concert (menys les seves despeses); si el grup tampoc en
  // té cap de personalitzat, es fa servir el predeterminat de fàbrica
  // (agència 20%, la resta a parts iguals). Res d'això es desa fins que
  // l'usuari toqui res.
  const [payouts, setPayouts] = useState<Record<string, number>>(() => {
    if (Object.keys(concert.payouts || {}).length) return { ...concert.payouts };
    // Mateixa aritmètica que més avall: les despeses compartides surten del
    // caixet abans de res; les del grup, del que es reparteixen músics i crew.
    const exp0 = splitExpenses(expenseList, concert.agencyAssumesExpenses !== false);
    const sharedNet0 = Math.max(0, (concert.amount || 0) - exp0.ambdos);
    const groupPool0 = Math.max(0, sharedNet0 - exp0.grup);
    const split = band?.defaultPayoutSplit;
    if (split && Object.keys(split).length) {
      const out: Record<string, number> = {};
      Object.entries(split).forEach(([n, pct]) => { out[n] = round2((pct / 100) * groupPool0); });
      return out;
    }
    const initialAttending: string[] = [];
    (band?.members || []).forEach((m) => {
      if (concert.attendance?.[m.name] === "no") {
        const sub = concert.substitutes?.[m.name];
        if (sub) initialAttending.push(sub);
      } else {
        initialAttending.push(m.name);
      }
    });
    const otherNames = [...initialAttending, ...(band?.crew || []).map((m) => m.name)];
    return agencyDefaultSplit(otherNames, groupPool0, sharedNet0);
  });
  const [payoutsSaving, setPayoutsSaving] = useState(false);
  const [savingDefaultSplit, setSavingDefaultSplit] = useState(false);
  const [defaultSplitSaved, setDefaultSplitSaved] = useState(false);
  // Qui ha editat el seu import/% a mà en aquesta sessió — els que encara no
  // hi són es reparteixen automàticament el que queda entre ells (per parts
  // iguals si encara no tenien res, o mantenint les proporcions que ja
  // tenien entre ells si ja n'hi havia).
  const [editedPayoutNames, setEditedPayoutNames] = useState<Set<string>>(new Set());

  // ---- Comparteix per confirmar (assistència) ----
  const [attToken, setAttToken] = useState(concert.attToken || "");
  const [attBusy, setAttBusy] = useState(false);
  const [attCopied, setAttCopied] = useState(false);

  // Pregunta "per a quins concerts?" (AttendanceLinkModal) — només si el
  // grup té més concerts propers a part d'aquest; si no, l'enllaç d'aquest
  // concert es crea (o es recupera) directament.
  const [attModal, setAttModal] = useState<{ intent: AttendanceLinkIntent; others: AttendanceLinkConcert[] } | null>(null);

  // ---- Eliminar l'esdeveniment sencer (zona de perill, al peu) ----
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function attWaText(url: string, multi: boolean): string {
    if (multi) {
      const what = concert.kind === "assaig" ? "propers assajos" : concert.kind === "reunio" ? "properes reunions" : "propers bolos";
      return `Hola! Confirmeu si sereu als ${what} de ${concert.bandName}: ${url}`;
    }
    return `Hola! Confirmeu si sereu al ${concert.kind === "assaig" ? "assaig" : concert.kind === "reunio" ? "la reunió" : "bolo"} de ${concert.bandName} el ${capitalize(formatDateFull(concert.date))}${concert.city ? " a " + concert.city.split(",")[0] : ""}: ${url}`;
  }

  async function runAttIntent(intent: AttendanceLinkIntent, token: string, multi: boolean) {
    const url = `${window.location.origin}/conf/${token}`;
    if (intent === "copy") {
      await navigator.clipboard.writeText(url);
      setAttCopied(true);
      window.setTimeout(() => setAttCopied(false), 1600);
    } else if (intent === "wa") {
      window.open(`https://wa.me/?text=${encodeURIComponent(attWaText(url, multi))}`, "_blank");
    } else {
      window.open(url, "_blank");
    }
  }

  async function startAtt(intent: AttendanceLinkIntent) {
    if (attBusy) return;
    setAttBusy(true);
    try {
      const list = await listAttendanceLinkConcertsAction(concert.id);
      const others = list.filter((c) => c.id !== concert.id);
      if (others.length === 0) {
        let t = attToken;
        if (!t) { t = (await createAttendanceLinkAction(concert.id)).token; setAttToken(t); }
        await runAttIntent(intent, t, false);
      } else {
        setAttModal({ intent, others });
      }
    } finally {
      setAttBusy(false);
    }
  }

  // ---- Rider i setlist ----
  const [riderId, setRiderId] = useState<string>(concert.riderId || "");
  const [setlistId, setSetlistId] = useState<string>(concert.setlistId || "");
  const [materialCopied, setMaterialCopied] = useState<string | null>(null);
  const [riderSearch, setRiderSearch] = useState("");
  const [riderPickerOpen, setRiderPickerOpen] = useState(false);
  const selectedRider = riders.find((r) => r.id === riderId) || null;
  const selectedSetlist = setlists.find((s) => s.id === setlistId) || null;
  const riderMatches = riders.filter((r) => !riderSearch.trim() || normalize(r.name).includes(normalize(riderSearch.trim())));
  // Cançons destacades d'aquest concert/assaig en concret
  // (Concert.setlistHighlights) — la mateixa setlist es pot repetir a
  // altres esdeveniments amb destacades diferents, per això no viu a la
  // setlist sinó al concert.
  const [setlistHighlights, setSetlistHighlights] = useState<Record<string, boolean>>(concert.setlistHighlights || {});
  async function toggleHighlight(title: string) {
    const next = { ...setlistHighlights };
    if (next[title]) delete next[title]; else next[title] = true;
    setSetlistHighlights(next);
    await setSetlistHighlightsAction(concert.id, next);
  }

  // ---- Aprovació del rider ----
  const [apName, setApName] = useState("");
  const [apEmail, setApEmail] = useState("");
  const [apFormOpen, setApFormOpen] = useState(false);
  const [apBusy, setApBusy] = useState(false);
  const [apEmailStatus, setApEmailStatus] = useState<Record<string, string>>({});
  const currentApprovals = riderApprovals.filter((a) => a.riderId === riderId);
  const approvedNow = currentApprovals.some((a) => a.status === "aprovat");

  async function selectRider(id: string) {
    setRiderId(id);
    setRiderPickerOpen(false);
    setRiderSearch("");
    await setConcertMaterialAction(concert.id, "rider", id || null);
    router.refresh();
  }

  async function handleSendApproval() {
    if (!riderId) return;
    setApBusy(true);
    await sendRiderApprovalAction({ concertId: concert.id, riderId, recipientName: apName, recipientEmail: apEmail });
    setApFormOpen(false);
    setApName(""); setApEmail("");
    router.refresh();
    setApBusy(false);
  }

  function approvalUrl(id: string): string {
    return `${window.location.origin}/a/${id}`;
  }

  function waApproval(a: RiderApproval) {
    const text = `Hola${a.recipientName ? " " + a.recipientName : ""}! Us passem el rider tècnic de ${concert.bandName} pel ${capitalize(formatDateFull(concert.date))}${concert.city ? " a " + concert.city : ""}. Podeu aprovar-lo o proposar canvis aquí: ${approvalUrl(a.id)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  async function copyMaterial(token: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/m/${token}`);
    setMaterialCopied(token);
    window.setTimeout(() => setMaterialCopied((v) => (v === token ? null : v)), 1600);
  }

  function waMaterial(token: string, what: string) {
    const text = `${what} de ${concert.bandName} pel bolo de ${capitalize(formatDateFull(concert.date))}${concert.city ? " a " + concert.city : ""}: ${window.location.origin}/m/${token}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  const accent = band?.color1 || bandColor(concert.bandId).color;
  const cityColor = bandColor("city:" + (cf.city || "?"));
  const venueColor = bandColor("venue:" + (cf.venue || "?"));
  const sc = statusColors(cf.status);

  const liveConcert: Concert = { ...concert, ...cf, amount: parseInt(cf.amount, 10) || 0, status: cf.status as Concert["status"], attendance: attendance as Concert["attendance"], substitutes, noSubstitute, convocatoriaExcluded, contact, canAnnounce: cf.canAnnounce as Concert["canAnnounce"], ticketType: cf.ticketType as Concert["ticketType"], routeSheet: liveRs ?? concert.routeSheet };
  const info = infoCompletion(liveConcert, { amountFilled: cf.amount.trim() !== "" });
  const rsPercent = rsCompletionPercent(liveConcert);
  const rsMissing = rsMissingList(liveConcert);

  const linkedByName: Record<string, LinkedMember> = {};
  linkedMembers.forEach((m) => { linkedByName[m.memberName] = m; });
  const requestByMember: Record<string, BackupRequest> = {};
  backupRequests.forEach((r) => { if (r.status === "oberta") requestByMember[r.memberName] = r; });

  const members = band?.members || [];
  const crew = band?.crew || [];
  const backups = band?.backups || [];

  function schedulePersist(next: typeof cf, att = attendance, subs = substitutes, noSubs = noSubstitute, excl = convocatoriaExcluded, cont = contact) {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      setSaving(true);
      await saveConcertAction({
        id: concert.id,
        bandName: concert.bandName,
        date: next.date, time: next.time, exactTime: next.exactTime, venue: next.venue, city: next.city, address: next.address,
        festaEntitat: next.festaEntitat, amount: parseInt(next.amount, 10) || 0, status: next.status,
        attendance: att, substitutes: subs, noSubstitute: noSubs, convocatoriaExcluded: excl, contact: cont,
        canAnnounce: next.canAnnounce as Concert["canAnnounce"], announceAfter: next.announceAfter,
        ticketType: next.ticketType as Concert["ticketType"],
        skipDefaults: true,
      });
      setSaving(false);
    }, 500);
    // El refresc de tota la pàgina (per si algun altre bloc en depèn) va a
    // part i amb un debounce més llarg que el desat: mentre s'escriu seguit
    // (per exemple l'import o el nom del lloc) no cal refer-la a cada pausa
    // de mig segon, només un cop l'usuari ja s'ha aturat de veres.
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => { router.refresh(); }, 2500);
  }

  function setField<K extends keyof typeof cf>(k: K, v: string) {
    const next = { ...cf, [k]: v };
    setCf(next);
    schedulePersist(next);
  }

  // Triar un recinte (des d'Informació o des del Full de ruta — el mateix
  // camp, en un sol canvi perquè no es trepitgin entre ells) actualitza
  // sempre la població si el recinte en sap una, i empleix l'adreça
  // (carrer, número i població) si en sap el detall — vegeu
  // resolvePlaceToVenueFields a VenueSearchField.tsx (compartit amb el modal
  // ràpid de "Nou esdeveniment").
  async function commitVenue(v: { name: string; city?: string; street?: string; housenumber?: string; lat?: number | null; lon?: number | null }) {
    const resolved = await resolvePlaceToVenueFields(v);
    const next = { ...cfRef.current, ...resolved };
    setCf(next);
    schedulePersist(next);
    if (resolved.address) setAddressAutofilled(true);
  }

  function setAttendanceFor(name: string, val: "yes" | "no" | null) {
    const att = { ...attendance };
    if (val === null) delete att[name]; else att[name] = val;
    setAttendance(att);
    schedulePersist(cf, att);
  }

  function setSubstituteFor(name: string, sub: string) {
    const subs = { ...substitutes };
    if (sub) subs[name] = sub; else delete subs[name];
    setSubstitutes(subs);
    const noSubs = { ...noSubstitute };
    if (sub) delete noSubs[name];
    setNoSubstitute(noSubs);
    schedulePersist(cf, attendance, subs, noSubs);
  }

  // Treu (o torna a afegir) un membre de la convocatòria d'aquest concert
  // en concret — mai del grup: només es desactiva visualment i queda fora
  // del recompte de la capçalera per a aquest bolo.
  function setExcludedFor(name: string, excluded: boolean) {
    const excl = { ...convocatoriaExcluded };
    if (excluded) excl[name] = true; else delete excl[name];
    setConvocatoriaExcluded(excl);
    schedulePersist(cf, attendance, substitutes, noSubstitute, excl);
  }

  function setContactField(field: keyof Concert["contact"], v: string) {
    const next = { ...contact, [field]: v };
    setContact(next);
    schedulePersist(cf, attendance, substitutes, noSubstitute, convocatoriaExcluded, next);
  }
  // En triar un suggeriment de l'autocompletat, s'omplen tots els camps
  // d'una sola vegada (no camp a camp) perquè no quedin desincronitzats.
  function pickContact(c: Contact) {
    const next = { name: c.name, phone: c.phone, email: c.email, company: c.company };
    setContact(next);
    schedulePersist(cf, attendance, substitutes, noSubstitute, convocatoriaExcluded, next);
  }

  // ---- Repartiment ----
  const attendingNames = useMemo(() => {
    const names: string[] = [];
    members.forEach((m) => {
      if (attendance[m.name] === "no") {
        const sub = substitutes[m.name];
        if (sub) names.push(sub);
      } else {
        names.push(m.name);
      }
    });
    return names;
  }, [members, attendance, substitutes]);

  const amountNum = parseInt(cf.amount, 10) || 0;
  // Base de la comissió de l'agència: el caixet menys les despeses
  // compartides ("agència i grup"). Les que paga l'agència surten de la
  // seva comissió; les que paga el grup, del que es reparteixen músics i
  // crew; les d'altres no compten enlloc.
  const sharedNet = Math.max(0, amountNum - expenseSplit.ambdos);
  // L'import de l'agència sempre es deriva del seu % (fix) i la base
  // vigent — mai a l'inrevés. Si canvien les despeses o el caixet, el %
  // no es toca; només varia aquest import.
  const agencyAmt = round2((agencyPct / 100) * sharedNet);
  // El que de veres li queda a l'agència un cop pagades les seves despeses.
  const agencyNet = round2(agencyAmt - expenseSplit.agencia);
  async function persistAgencyPct(pct: number) {
    setAgencyPct(pct);
    await setAgencyPctAction(concert.id, pct);
    router.refresh();
  }
  // Manté payouts["Agència"] sincronitzat amb l'import derivat (per a les
  // altres pantalles — artista, estadístiques — que llegeixen aquesta
  // clau directament del repartiment desat).
  useEffect(() => {
    if (round2(payouts[AGENCY_PAYOUT_NAME] || 0) === agencyAmt) return;
    const next = { ...payouts, [AGENCY_PAYOUT_NAME]: agencyAmt };
    setPayouts(next);
    persistPayouts(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyAmt]);

  // La comissió de l'agència sempre va a part, mai barrejada amb el
  // repartiment de músics i crew: primer es treu el seu tall, i el que
  // quedi (bandPool) és el 100% que es reparteixen entre ells — els seus %
  // sempre sumen 100% entre ells mateixos, no es dilueixen amb el de
  // l'agència.
  const bandNames = [...attendingNames, ...crew.map((m) => m.name)];
  const bandPool = Math.max(0, sharedNet - agencyAmt - expenseSplit.grup);
  const bandTotal = bandNames.reduce((s, n) => s + (payouts[n] || 0), 0);
  // Instrument/càrrec de cadascú, al costat del nom (els substituts, que no
  // són cap Person registrat del grup, senzillament no en mostren cap).
  const payoutPersonByName: Record<string, { role: string; instruments?: string[] }> = {};
  members.forEach((m) => { payoutPersonByName[m.name] = m; });
  crew.forEach((m) => { payoutPersonByName[m.name] = m; });

  // Editar l'import a mà de l'agència en realitat fixa un nou % (el que
  // representi aquell import sobre la base vigent) — mai queda com un
  // import solt independent del %.
  function editAgencyAmount(value: number) {
    value = Math.max(0, round2(value));
    // Sense arrodonir el % a l'enter més proper: si no, per exemple 5€
    // sobre un caixet de 1000€ (0,5%) es convertia en 0% o 1% (0€ o 10€) i
    // no es podia escriure l'import de veres — el % es guarda amb tota la
    // precisió que calgui perquè l'import reconstruït sigui exacte.
    const pct = sharedNet ? (value / sharedNet) * 100 : agencyPct;
    persistAgencyPct(pct);
  }
  function editAgencyPct(pct: number) {
    persistAgencyPct(Math.max(0, pct));
  }

  function equalSplit() {
    if (!bandNames.length || !bandPool) return;
    const totalCents = toCents(bandPool);
    const per = Math.floor(totalCents / bandNames.length);
    const next: Record<string, number> = { ...payouts };
    bandNames.forEach((n, i) => { next[n] = (per + (i === 0 ? totalCents - per * bandNames.length : 0)) / 100; });
    setPayouts(next);
    setEditedPayoutNames(new Set());
    persistPayouts(next);
  }

  async function persistPayouts(next: Record<string, number>) {
    setPayoutsSaving(true);
    await savePayoutsAction(concert.id, next);
    router.refresh();
    setPayoutsSaving(false);
  }

  async function saveAsDefaultSplit() {
    if (!band) return;
    const split: Record<string, number> = {};
    split[AGENCY_PAYOUT_NAME] = agencyPct;
    bandNames.forEach((n) => { split[n] = bandPool ? Math.round(((payouts[n] || 0) / bandPool) * 100) : 0; });
    setSavingDefaultSplit(true);
    await saveDefaultPayoutSplitAction(band.id, split);
    router.refresh();
    setSavingDefaultSplit(false);
    setDefaultSplitSaved(true);
    window.setTimeout(() => setDefaultSplitSaved(false), 2500);
  }

  // Si canvia el que queda per repartir entre músics i crew (bandPool —
  // perquè canvien les despeses, el caixet, o la pròpia comissió de
  // l'agència), es reescala tot el seu repartiment ja fet
  // proporcionalment, mantenint els % que hi havia entre ells — mai
  // deixant els imports antics tal qual (que ja no sumarien el total
  // correcte).
  // Només es reescalen els que encara NO s'han editat a mà (la mateixa
  // bossa que fa servir editPayout) — qui ja s'ha fixat un
  // import o % es queda tal qual, encara que canviï el bandPool (despeses,
  // caixet o comissió de l'agència).
  const prevBandPoolRef = useRef(bandPool);
  useEffect(() => {
    const prevPool = prevBandPoolRef.current;
    prevBandPoolRef.current = bandPool;
    if (prevPool === bandPool || !bandNames.length) return;
    const next = redistributeAmongFree(editedPayoutNames);
    setPayouts(next);
    persistPayouts(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bandPool]);

  // Xarxa de seguretat: si per qualsevol motiu (imports fixats a mà que
  // sumin més del compte, un bandPool que ha encongit per sota del que ja
  // hi havia fixat...) el total repartit se surt del bandPool, es
  // reescala TOT (fins i tot els imports fixats) proporcionalment perquè
  // hi torni a cabre exactament — mantenint els % relatius de cadascú
  // entre ells, mai deixant-ho "per sobre" del pressupost.
  useEffect(() => {
    if (!bandNames.length || bandTotal <= bandPool + 0.01 || bandTotal <= 0) return;
    const scale = bandPool / bandTotal;
    const next: Record<string, number> = { ...payouts };
    bandNames.forEach((n) => { next[n] = round2((payouts[n] || 0) * scale); });
    setPayouts(next);
    persistPayouts(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bandTotal, bandPool]);

  // En editar l'import (o el %, que passa per aquí igual un cop convertit a
  // €) d'un músic o d'algú de la crew, la resta del bandPool es reparteix
  // automàticament entre els que encara no s'han tocat en aquesta sessió:
  // a parts iguals si encara no tenien res assignat, o mantenint les
  // proporcions que ja tenien entre ells si ja n'hi havia (encara que el
  // nou total se surti del bandPool — llavors la resta simplement es
  // reparteix la part que quedi, amb el mateix criteri). Mai es deixa cap
  // import en negatiu: com a molt, 0. Tot es mou en cèntims per no
  // arrossegar errors d'arrodoniment. L'agència no hi entra mai — sempre
  // va a part (editAgencyAmount / editAgencyPct).
  function redistributeAmongFree(editedNames: Set<string>, overrides: Record<string, number> = {}): Record<string, number> {
    const next: Record<string, number> = { ...payouts, ...overrides };
    const free = bandNames.filter((n) => !editedNames.has(n));
    const editedSumCents = bandNames.filter((n) => editedNames.has(n)).reduce((s, n) => s + toCents(next[n] || 0), 0);
    const remainingCents = Math.max(0, toCents(bandPool) - editedSumCents);
    if (free.length) {
      const freeCurrentSumCents = free.reduce((s, n) => s + toCents(payouts[n] || 0), 0);
      let assignedCents = 0;
      free.forEach((n, i) => {
        const isLast = i === free.length - 1;
        const share = freeCurrentSumCents > 0 ? toCents(payouts[n] || 0) / freeCurrentSumCents : 1 / free.length;
        const vCents = Math.max(0, isLast ? remainingCents - assignedCents : Math.round(share * remainingCents));
        next[n] = vCents / 100;
        assignedCents += vCents;
      });
    }
    return next;
  }
  function editPayout(name: string, value: number) {
    value = Math.max(0, round2(value));
    const newEdited = new Set(editedPayoutNames);
    newEdited.add(name);
    const next = redistributeAmongFree(newEdited, { [name]: value });
    setPayouts(next);
    setEditedPayoutNames(newEdited);
  }
  // ---- Facturació ----
  const [invEditOpen, setInvEditOpen] = useState(false);
  const [invEdit, setInvEdit] = useState({ base: "", iva: "21", irpf: "0", deposit: "0" });
  const [reminderEmail, setReminderEmail] = useState("");
  const [reminding, setReminding] = useState(false);
  const [reminderStatus, setReminderStatus] = useState<string | null>(null);
  const invTotals = invoice ? computeInvoiceTotals(invoice.baseAmount, invoice.ivaRate, invoice.irpfRate) : { iva: 0, irpf: 0, total: 0 };
  const daysOut = invoice ? Math.max(0, Math.round((new Date(today).getTime() - new Date(invoice.issueDate).getTime()) / 86400000)) : 0;
  const clientKey = concert.venue;
  const cd = clientDetails[clientKey] || { clientName: clientKey, cif: "", nom: "", address: "" };
  const [clientForm, setClientForm] = useState({ nom: cd.nom, cif: cd.cif, address: cd.address });

  async function handleGenerateInvoice() {
    setGenerating(true);
    await generateInvoiceAction(concert.id);
    router.refresh();
    setGenerating(false);
  }

  async function handleCreateLink() {
    setCreatingLink(true);
    const { url } = await createShareLinkAction({
      concertId: concert.id, scope: linkScope, recipientEmail: linkEmail, recipientName: linkName, days: linkDays,
    });
    setLastCreatedUrl(url);
    setNewLinkOpen(false);
    setLinkEmail(""); setLinkName("");
    router.refresh();
    setCreatingLink(false);
  }

  function linkUrl(id: string): string {
    return `${window.location.origin}/f/${id}`;
  }

  async function copyLink(id: string) {
    await navigator.clipboard.writeText(linkUrl(id));
    setCopied(id);
    window.setTimeout(() => setCopied((v) => (v === id ? null : v)), 1600);
  }

  function whatsappLink(l: ShareLink) {
    const text = `Hola${l.recipientName ? " " + l.recipientName : ""}! Ens falten dades del concert de ${concert.bandName} (${capitalize(formatDateFull(concert.date))}${concert.city ? ", " + concert.city : ""}). Les pots omplir aquí: ${linkUrl(l.id)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  async function handleSendEmail(id: string) {
    setEmailStatus((p) => ({ ...p, [id]: "enviant…" }));
    const res = await sendShareLinkEmailAction(id);
    setEmailStatus((p) => ({ ...p, [id]: res.ok ? "enviat ✓" : res.error || "error" }));
    router.refresh();
  }

  const scopeLabels: Record<string, string> = { info: "Informació", ruta: "Full de ruta", both: "Info + full de ruta" };

  return (
    <div className="glow concert-detail" style={{ ["--band-accent" as string]: accent }}>
      <div className="glow-blooms" aria-hidden="true"></div>

      {/* Capçalera */}
      <div className="cd-topbar">
        <BackLink href="/concerts">Concerts</BackLink>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {saving && <span className="t-dim" style={{ fontSize: 12 }}>Desant…</span>}
        </div>
      </div>

      {clashes.length > 0 && (
        <div className="clash-banner">
          <strong>⚠ Possible conflicte de dates</strong>
          {clashes.map((c, i) => <div key={i}>{c}</div>)}
        </div>
      )}

      {/* Pòster: capçalera tipogràfica del concert */}
      <div className="cd-poster">
        <div className="cd-poster-glow" aria-hidden="true"></div>
        <div className="cd-poster-kicker">{concert.bandName}</div>
        <div className="cd-poster-subtitle">
          {cf.festaEntitat || (kind === "bolo" ? "concert" : kind === "reunio" ? "reunió" : kind)}
        </div>
        {cf.city && <div className="cd-poster-title">{cf.city.split(",")[0]}</div>}
        {cf.venue && (
          <div className="cd-poster-place">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            {cf.venue}
          </div>
        )}
        <div className="cd-poster-date">{capitalize(formatDateFull(cf.date))}{cf.exactTime ? ` — ${cf.exactTime}` : cf.time ? ` — ${formatConcertTime(cf.time)}` : ""}</div>
        <div className="cd-poster-foot">
          <button
            type="button" className="badge-btn" style={{ background: sc.bg, color: sc.color }}
            onClick={() => setField("status", STATUS_CYCLE[(STATUS_CYCLE.indexOf(cf.status) + 1) % STATUS_CYCLE.length])}
          >{cf.status}</button>
          {/* El caixet i els mesuradors són clicables: cadascun porta a la
              seva pestanya (facturació, informació, full de ruta, convocatòria). */}
          <div
            className="cd-hero-amount clickable" role="button" tabIndex={0} aria-label="Caixet — obre Despeses i facturació"
            onClick={() => setTab("facturacio")}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setTab("facturacio"); } }}
          >{formatCurrency(amountNum)}</div>
          <div className="cd-meters">
            <Meter label="Informació" percent={info.percent} missing={info.missing} onClick={() => setTab("info")} />
            <Meter label="Full de ruta" percent={rsPercent} missing={rsMissing} onClick={() => setTab("ruta")} />
            {(members.length > 0 || crew.length > 0) && (
              <AttendanceMeter people={[...members, ...crew]} attendance={attendance} excluded={convocatoriaExcluded} substitutes={substitutes} onClick={() => setTab("assistencia")} />
            )}
          </div>
          <div className="cd-poster-actions">
            <Link href={`/concerts/${concert.id}/dia`} className="cd-poster-icon-btn" title="Tota la info del dia del bolo en una sola pantalla de mòbil">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
            </Link>
            <button type="button" className="cd-poster-icon-btn" onClick={() => setPosterOpen(true)}
              title="Genera un pòster transparent per a Instagram amb el mapa i les dades del concert">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Subpestanyes */}
      <div className="stats-tabs cd-tabs">
        {([["info", "Informació"], ["ruta", "Full de ruta"], ["assistencia", "Convocatòria"], ["facturacio", "Despeses i facturació"]] as const).map(([k, label]) => (
          <button key={k} type="button" className={"stats-tab" + (tab === k ? " active" : "")} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {/* Informació */}
      {tab === "info" && (<>
      <div className="panel cd-section" id="cd-contact">
        <div className="panel-title cd-section-title">Contacte</div>
        <div className="cd-contact-row">
          <ContactAutocomplete className="field-input form-field" placeholder="Nom" value={contact.name} onNameChange={(v) => setContactField("name", v)} onPick={pickContact} contacts={contacts} />
          <input className="field-input form-field" type="text" placeholder="Telèfon" value={contact.phone} onChange={(e) => setContactField("phone", e.target.value)} />
          <input className="field-input form-field" type="email" placeholder="Correu" value={contact.email} onChange={(e) => setContactField("email", e.target.value)} />
          <input className="field-input form-field" type="text" placeholder="Empresa" value={contact.company} onChange={(e) => setContactField("company", e.target.value)} />
        </div>
      </div>
      <div className="panel cd-section" id="cd-info">
        <div className="panel-title cd-section-title">Informació general</div>
        <div className="cd-info-grid">
          <div className="cd-field">
            <label className="form-label">Tipus d&apos;esdeveniment</label>
            <button
              type="button" className="cd-kind-bubble" style={{ background: KIND_META[kind]?.bg, color: KIND_META[kind]?.color }}
              onClick={async () => {
                const order = ["bolo", "assaig", "reunio", "altre"];
                const v = order[(order.indexOf(kind) + 1) % order.length] as "bolo" | "assaig" | "reunio" | "altre";
                setKind(v);
                await setConcertKindAction(concert.id, v);
                router.refresh();
              }}
            >
              {KIND_META[kind]?.label || kind}
            </button>
          </div>
          <div className="cd-field">
            <label className="form-label">Títol</label>
            <input className="field-input form-field" value={cf.festaEntitat} onChange={(e) => setField("festaEntitat", e.target.value)} placeholder="Festa major, ajuntament…" />
          </div>
          <div className="cd-field">
            <label className="form-label">Data</label>
            <InlineDatePicker value={cf.date} onChange={(v) => setField("date", v)} today={today} />
          </div>
          <div className="cd-field cd-time-pair-field">
            <div className="cd-time-pair-row">
              <div className="cd-time-pair-col" style={{ flex: 1.2 }}>
                <label className="form-label">Hora aproximada</label>
                <div className="cd-time-pair-col-body">
                  <TimePeriodBubble time={cf.time} onChange={(v) => setField("time", v)} />
                </div>
              </div>
              <div className="cd-time-pair-col grow">
                <label className="form-label">Hora exacta</label>
                <div className="cd-time-pair-col-body">
                  <input type="time" className="field-input form-field" value={cf.exactTime} onChange={(e) => setField("exactTime", e.target.value)} />
                </div>
              </div>
            </div>
          </div>
          <div className="cd-field">
            <label className="form-label">Recinte</label>
            <VenueSearchField venue={cf.venue} onCommit={(v) => { const next = { ...cfRef.current, ...v }; setCf(next); schedulePersist(next); if (v.address) setAddressAutofilled(true); }} />
          </div>
          <div className="cd-field">
            <label className="form-label">Adreça</label>
            <input
              className="field-input form-field" type="text" placeholder="S'empleix en triar un recinte…"
              value={cf.address} onChange={(e) => { setField("address", e.target.value); setAddressAutofilled(false); }}
            />
            {addressAutofilled && (
              <div className="rs-autofill-note" style={{ marginTop: 4 }}><WarnIcon />Adreça generada automàticament, comprova que sigui correcta</div>
            )}
          </div>
          {kind === "bolo" && (
            <>
              <div className="cd-field">
                <label className="form-label">Import (sense IVA)</label>
                <input type="number" className="field-input form-field" value={cf.amount} onChange={(e) => setField("amount", e.target.value)} />
              </div>
              <div className="cd-field cd-time-pair-field">
                <div className="cd-time-pair-row">
                  <div className="cd-time-pair-col">
                    <label className="form-label">Es pot anunciar?</label>
                    <div className="cd-time-pair-col-body">
                      <div className="cd-att-controls">
                        <button type="button" className={"cd-att-btn yes" + (cf.canAnnounce === "yes" ? " active" : "")} onClick={() => setField("canAnnounce", cf.canAnnounce === "yes" ? "" : "yes")}>Sí</button>
                        <button type="button" className={"cd-att-btn no" + (cf.canAnnounce === "no" ? " active" : "")} onClick={() => setField("canAnnounce", cf.canAnnounce === "no" ? "" : "no")}>No</button>
                      </div>
                    </div>
                  </div>
                  {/* Sempre muntada (només s'amaga) perquè revelar-la no faci
                      créixer la fila i desplaci el títol/pestanyes de sí/no. */}
                  <div className="cd-time-pair-col grow" style={{ visibility: cf.canAnnounce === "no" ? "visible" : "hidden" }} aria-hidden={cf.canAnnounce !== "no"}>
                    <label className="form-label">Fins al dia</label>
                    <div className="cd-time-pair-col-body">
                      <InlineDatePicker value={cf.announceAfter} onChange={(v) => setField("announceAfter", v)} today={today} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="cd-field">
                <label className="form-label">Tipus d&apos;entrada</label>
                <div className="cd-att-controls">
                  <button type="button" className={"cd-att-btn neutral" + (cf.ticketType === "gratuit" ? " active" : "")} onClick={() => setField("ticketType", cf.ticketType === "gratuit" ? "" : "gratuit")}>Gratuïta</button>
                  <button type="button" className={"cd-att-btn neutral" + (cf.ticketType === "pagament" ? " active" : "")} onClick={() => setField("ticketType", cf.ticketType === "pagament" ? "" : "pagament")}>De pagament</button>
                </div>
              </div>
            </>
          )}
          {(kind === "assaig" || kind === "reunio" || kind === "altre") && (
            <div className="cd-field cd-time-pair-field">
              <div className="cd-time-pair-row">
                <div className="cd-time-pair-col">
                  <label className="form-label">Es repeteix</label>
                  <div className="cd-time-pair-col-body">
                    <select className="field-input form-field" value={repeatFreq} onChange={(e) => setRepeatFreq(e.target.value as typeof repeatFreq)}>
                      <option value="cap">No es repeteix</option>
                      <option value="setmanal">Cada setmana</option>
                      <option value="quinzenal">Cada 2 setmanes</option>
                      <option value="mensual">Cada mes</option>
                    </select>
                  </div>
                </div>
                {/* Sempre muntada (només s'amaga) perquè triar una freqüència
                    no faci créixer la fila ni desplaci el títol/selector. */}
                <div className="cd-time-pair-col grow" style={{ visibility: repeatFreq !== "cap" ? "visible" : "hidden" }} aria-hidden={repeatFreq === "cap"}>
                  <label className="form-label">Fins al dia</label>
                  <div className="cd-time-pair-col-body">
                    <InlineDatePicker
                      value={repeatUntil} onChange={(v) => { setRepeatUntil(v); handleRepeat(v); }} today={today}
                      minDate={cf.date} initialMonth={cf.date} highlightDates={repeatOccurrences}
                    />
                  </div>
                  {(repeating || repeatResult) && (
                    <div className="t-dim" style={{ fontSize: 11.5, marginTop: 4 }}>{repeating ? "Creant…" : repeatResult}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </>)}

      {/* Assistència */}
      {tab === "assistencia" && (
      <div className="panel cd-section" id="cd-assistencia">
        {/* Compartida per tots els camps de substitut d'aquesta pestanya —
            suggereix els suplents de confiança del grup, però deixa
            escriure qualsevol altre nom que encara no hi sigui guardat. */}
        <datalist id="cd-backups-list">
          {backups.map((b) => <option key={b.name} value={b.name} />)}
        </datalist>
        <div className="panel-header-row cd-section-title">
          <div className="panel-title">Convocatòria</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {linkedMembers.some((lm) => attendance[lm.memberName] !== "yes" && attendance[lm.memberName] !== "no") && (
              <button
                type="button" className="btn-outline" disabled={!emailReady || nudging}
                title={emailReady ? "Correu als membres amb compte que encara no han respost" : "Configura RESEND_API_KEY per enviar correus"}
                onClick={async () => {
                  setNudging(true);
                  const res = await nudgeAttendanceAction(concert.id);
                  setNudgeResult(res.ok ? `${res.sent} recordatoris enviats ✓` : res.error || "error");
                  setNudging(false);
                }}
              >{nudgeResult || (nudging ? "Enviant…" : "Recorda-ho als pendents")}</button>
            )}
            <div className="t-dim" style={{ fontSize: 12 }}>
              {members.filter((m) => attendance[m.name] === "yes").length}/{members.length} confirmats
            </div>
          </div>
        </div>
        {members.length === 0 ? (
          <div className="t-dim" style={{ fontSize: 13 }}>Aquest concert no té grup amb membres assignat.</div>
        ) : (
          <div className="cd-attendance-list">
            {members.map((m) => {
              const linked = linkedByName[m.name];
              const att = attendance[m.name];
              const req = requestByMember[m.name];
              const inss = instrumentsFor(m);
              const excluded = !!convocatoriaExcluded[m.name];
              return (
                <div key={m.name} className={"cd-att-row" + (att === "no" ? " att-no" : att === "yes" ? " att-yes" : "") + (excluded ? " att-excluded" : "")}>
                  <img className="member-photo backup-photo" src={photosByName[normalize(m.name)] ? `/api/file/${photosByName[normalize(m.name)]}` : personPhotoDataUri(m.name)} alt="" />
                  <div className="cd-att-main">
                    <div className="member-name">
                      {m.name}
                      {linked && <VerifiedTick size={13} title={`Usuari d'Escenari: ${linked.email} — pot confirmar des de la seva app`} />}
                    </div>
                    <div className="member-instruments">
                      {inss.slice(0, 3).map((ins) => {
                        const icon = instrumentIconFor(ins);
                        return <span key={ins} className="member-instrument-chip">{icon && <img src={icon} alt="" />}{ins}</span>;
                      })}
                    </div>
                  </div>
                  {!excluded && (
                    <div className="cd-att-controls">
                      <button type="button" className={"cd-att-btn yes" + (att === "yes" ? " active" : "")} onClick={() => setAttendanceFor(m.name, att === "yes" ? null : "yes")}>Sí</button>
                      <button type="button" className={"cd-att-btn no" + (att === "no" ? " active" : "")} onClick={() => setAttendanceFor(m.name, att === "no" ? null : "no")}>No</button>
                    </div>
                  )}
                  <button type="button" className="cd-att-exclude-btn" title={excluded ? "Torna a la convocatòria" : "Treu de la convocatòria d'aquest bolo"}
                    onClick={() => setExcludedFor(m.name, !excluded)}>
                    {excluded ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    )}
                  </button>
                  {!excluded && att === "no" && (
                    <div className="cd-att-sub">
                      <input
                        className="field-input compact-field"
                        type="text" list="cd-backups-list" placeholder="Nom del suplent…"
                        value={substitutes[m.name] || ""}
                        onChange={(e) => setSubstituteFor(m.name, e.target.value)}
                      />
                      {!substitutes[m.name] && !req && (
                        <button
                          type="button" className="btn-outline cd-publish-btn"
                          onClick={async () => {
                            await publishBackupRequestAction({
                              bandId: concert.bandId, concertId: concert.id, memberName: m.name,
                              instruments: inss, note: "",
                            });
                            router.refresh();
                          }}
                        >Publica cerca de suplent</button>
                      )}
                      {req && (
                        <SubRequestBox
                          req={req}
                          onDecided={(app, status) => { if (status === "acceptada") setSubstitutes((prev) => ({ ...prev, [m.name]: app.name })); router.refresh(); }}
                          onWithdraw={async () => { await setBackupRequestStatusAction(req.id, "cancel·lada"); router.refresh(); }}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Crew: mateix seguiment d'assistència i mateixa cerca de suplent
            que els músics (tria entre els backups del grup o publica una
            cerca oberta a la borsa) — sense repartiment, que és cosa dels
            músics. La cerca oberta hi busca un "càrrec" (m.role) en comptes
            d'instruments. */}
        {crew.length > 0 && (
          <>
            <div className="panel-header-row cd-section-title" style={{ marginTop: 24 }}>
              <div className="panel-title" style={{ fontSize: 15 }}>Crew</div>
              <div className="t-dim" style={{ fontSize: 12 }}>
                {crew.filter((m) => attendance[m.name] === "yes").length}/{crew.length} confirmats
              </div>
            </div>
            <div className="cd-attendance-list">
              {crew.map((m) => {
                const linked = linkedByName[m.name];
                const att = attendance[m.name];
                const req = requestByMember[m.name];
                const excluded = !!convocatoriaExcluded[m.name];
                return (
                  <div key={m.name} className={"cd-att-row" + (att === "no" ? " att-no" : att === "yes" ? " att-yes" : "") + (excluded ? " att-excluded" : "")}>
                    <img className="member-photo backup-photo" src={photosByName[normalize(m.name)] ? `/api/file/${photosByName[normalize(m.name)]}` : personPhotoDataUri(m.name)} alt="" />
                    <div className="cd-att-main">
                      <div className="member-name">
                        {m.name}
                        {linked && <VerifiedTick size={13} title={`Usuari d'Escenari: ${linked.email} — pot confirmar des de la seva app`} />}
                      </div>
                      {m.role && <div className="member-instruments"><span className="member-instrument-chip">{m.role}</span></div>}
                    </div>
                    {!excluded && (
                      <div className="cd-att-controls">
                        <button type="button" className={"cd-att-btn yes" + (att === "yes" ? " active" : "")} onClick={() => setAttendanceFor(m.name, att === "yes" ? null : "yes")}>Sí</button>
                        <button type="button" className={"cd-att-btn no" + (att === "no" ? " active" : "")} onClick={() => setAttendanceFor(m.name, att === "no" ? null : "no")}>No</button>
                      </div>
                    )}
                    <button type="button" className="cd-att-exclude-btn" title={excluded ? "Torna a la convocatòria" : "Treu de la convocatòria d'aquest bolo"}
                      onClick={() => setExcludedFor(m.name, !excluded)}>
                      {excluded ? (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
                      ) : (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      )}
                    </button>
                    {!excluded && att === "no" && (
                      <div className="cd-att-sub">
                        <input
                          className="field-input compact-field"
                          type="text" list="cd-backups-list" placeholder="Nom del suplent…"
                          value={substitutes[m.name] || ""}
                          onChange={(e) => setSubstituteFor(m.name, e.target.value)}
                        />
                        {!substitutes[m.name] && !req && (
                          <button
                            type="button" className="btn-outline cd-publish-btn"
                            onClick={async () => {
                              await publishBackupRequestAction({
                                bandId: concert.bandId, concertId: concert.id, memberName: m.name,
                                role: m.role, note: "",
                              });
                              router.refresh();
                            }}
                          >Publica cerca de suplent</button>
                        )}
                        {req && (
                          <SubRequestBox
                            req={req}
                            onDecided={(app, status) => { if (status === "acceptada") setSubstitutes((prev) => ({ ...prev, [m.name]: app.name })); router.refresh(); }}
                            onWithdraw={async () => { await setBackupRequestStatusAction(req.id, "cancel·lada"); router.refresh(); }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Comparteix per confirmar */}
        {members.length > 0 && (
          <div className="cfm-share-box">
            <div>
              <div className="cd-subtitle" style={{ marginBottom: 4 }}>Comparteix per confirmar</div>
              <div className="t-dim" style={{ fontSize: 12.5 }}>
                Un enllaç per al grup: cada músic es marca, entra amb el seu compte i confirma si hi serà —
                per a aquest concert o per a uns quants de propers alhora.
                Qui no tingui compte se&apos;l crea en un moment i queda vinculat al grup.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button type="button" className="btn-save cd-send-convocatoria-btn" disabled={attBusy} onClick={() => startAtt("wa")}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                {attBusy ? "Creant…" : "Enviar convocatòria"}
              </button>
              <button type="button" className="btn-outline cd-copy-link-btn" disabled={attBusy} onClick={() => startAtt("copy")}>
                {attCopied ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                )}
                {attCopied ? "Copiat ✓" : "Copia l'enllaç"}
              </button>
              <button type="button" className="link-btn" disabled={attBusy} onClick={() => startAtt("open")}>Obre</button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Full de ruta */}
      {tab === "ruta" && (
      <div className="panel cd-section" id="cd-ruta">
        <div className="panel-header-row cd-section-title">
          <div className="panel-title">Full de ruta</div>
          <button type="button" className="btn-outline" onClick={() => setRsPreviewOpen(true)}>Previsualitza</button>
        </div>
        <RouteSheetEditor concert={concert} venue={cf.venue} city={cf.city} onVenueCityChange={commitVenue} address={cf.address} onAddressChange={(v) => setField("address", v)} exactTime={cf.exactTime} onExactTimeChange={(v) => setField("exactTime", v)} vehicles={band?.vehicles || []} bandDefaultRouteSheet={band?.defaultRouteSheet || null} contacts={contacts} onRouteSheetChange={setLiveRs} />
      </div>
      )}

      {/* Rider i setlist */}
      {tab === "info" && (
      <FoldPanel id="cd-material" title="Documents" summary={`${selectedRider ? selectedRider.name : "sense rider"} · ${selectedSetlist ? selectedSetlist.name : "sense setlist"}`} defaultOpen={!!(selectedRider || selectedSetlist)}>
        <div className="cd-material-grid">
          <div className="cd-material-col">
            <div className="cd-subtitle">
              Rider tècnic del bolo
              {approvedNow && <span className="cd-link-status activa" style={{ marginLeft: 10 }}>aprovat ✓</span>}
            </div>

            {/* Cercador de riders per nom */}
            <div className="rider-picker">
              <input
                className="field-input form-field"
                placeholder={selectedRider ? selectedRider.name : "Cerca un rider pel nom…"}
                value={riderSearch}
                onFocus={() => setRiderPickerOpen(true)}
                onChange={(e) => { setRiderSearch(e.target.value); setRiderPickerOpen(true); }}
              />
              {riderPickerOpen && (
                <>
                  <div className="year-picker-overlay" onClick={() => setRiderPickerOpen(false)}></div>
                  <div className="rider-picker-dropdown">
                    <button type="button" className="year-option" onClick={() => selectRider("")}>— Cap rider —</button>
                    {riderMatches.map((r) => (
                      <button key={r.id} type="button" className={"year-option" + (riderId === r.id ? " active" : "")} onClick={() => selectRider(r.id)}>
                        {r.name}
                        <span className="t-dim" style={{ fontSize: 11, marginLeft: 8 }}>{r.content.stage.items.length} elements</span>
                      </button>
                    ))}
                    {riderMatches.length === 0 && <div className="t-dim" style={{ padding: "8px 12px", fontSize: 12 }}>Cap rider amb aquest nom.</div>}
                  </div>
                </>
              )}
            </div>

            {selectedRider ? (
              <>
                <div className="cd-material-actions">
                  <button type="button" className="btn-outline" onClick={() => window.open(`/m/${selectedRider.publicToken}`, "_blank")}>Obre / PDF</button>
                  <button type="button" className="btn-outline" onClick={() => router.push(`/rider/${selectedRider.id}`)}>Edita</button>
                  <button type="button" className="btn-outline" onClick={() => copyMaterial(selectedRider.publicToken)}>{materialCopied === selectedRider.publicToken ? "Copiat ✓" : "Copia enllaç"}</button>
                  <button type="button" className="btn-outline cd-wa-btn" onClick={() => waMaterial(selectedRider.publicToken, "Rider tècnic")}>WhatsApp</button>
                </div>

                {/* Aprovació */}
                <div className="approval-block">
                  {currentApprovals.map((a) => (
                    <div key={a.id} className="approval-row">
                      <div className="approval-row-main">
                        <span className={"cd-link-status " + (a.status === "aprovat" ? "activa" : a.status === "contrarider" ? "counter" : "pending")}>
                          {a.status === "aprovat" ? "aprovat ✓" : a.status === "contrarider" ? "contrarider rebut" : "pendent d'aprovar"}
                        </span>
                        <span className="t-dim" style={{ fontSize: 12 }}>
                          {a.recipientName || a.recipientEmail || "Sense destinatari"}
                          {a.emailSentAt ? " · correu enviat" : ""}
                        </span>
                        {a.status === "contrarider" && a.counterNote && (
                          <span className="t-dim" style={{ fontSize: 12, fontStyle: "italic" }}>&ldquo;{a.counterNote}&rdquo;</span>
                        )}
                      </div>
                      <div className="approval-row-actions">
                        {a.status !== "aprovat" && (
                          <>
                            <button type="button" className="btn-outline" onClick={async () => { await navigator.clipboard.writeText(approvalUrl(a.id)); setApEmailStatus((p) => ({ ...p, [a.id]: "enllaç copiat ✓" })); }}>Copia</button>
                            <button type="button" className="btn-outline cd-wa-btn" onClick={() => waApproval(a)}>WhatsApp</button>
                            {a.recipientEmail && (
                              <button
                                type="button" className="btn-outline" disabled={!emailReady}
                                title={emailReady ? `Envia a ${a.recipientEmail}` : "Configura RESEND_API_KEY per enviar correus"}
                                onClick={async () => {
                                  setApEmailStatus((p) => ({ ...p, [a.id]: "enviant…" }));
                                  const res = await sendApprovalEmailAction(a.id);
                                  setApEmailStatus((p) => ({ ...p, [a.id]: res.ok ? "enviat ✓" : res.error || "error" }));
                                  router.refresh();
                                }}
                              >{apEmailStatus[a.id] || "Correu"}</button>
                            )}
                          </>
                        )}
                        {a.status === "contrarider" && a.hasCounter && (
                          <>
                            <button type="button" className="btn-outline" onClick={() => window.open(`/a/${a.id}`, "_blank")}>Veu els canvis</button>
                            <button type="button" className="btn-save" onClick={async () => { await acceptCounterRiderAction(a.id); router.refresh(); }}>Accepta el contrarider</button>
                          </>
                        )}
                        <button type="button" className="row-delete-btn" title="Retira aquesta sol·licitud" onClick={async () => { await deleteRiderApprovalAction(a.id); router.refresh(); }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                      </div>
                    </div>
                  ))}

                  {apFormOpen ? (
                    <div className="approval-form">
                      <input className="field-input compact-field" placeholder="Nom (tècnic de la sala…)" value={apName} onChange={(e) => setApName(e.target.value)} />
                      <input className="field-input compact-field" type="email" placeholder="Correu (opcional)" value={apEmail} onChange={(e) => setApEmail(e.target.value)} />
                      <button type="button" className="btn-outline" onClick={() => setApFormOpen(false)}>Cancel·la</button>
                      <button type="button" className="btn-save" disabled={apBusy} onClick={handleSendApproval}>{apBusy ? "Creant…" : "Crea l'enllaç"}</button>
                    </div>
                  ) : !approvedNow && (
                    <SpecularButton size="md" radius={12} tint="#8b7bff" tintOpacity={0.3} baseColor="#8b7bff" lineColor="#ffffff" onClick={() => setApFormOpen(true)}>
                      Envia per aprovar
                    </SpecularButton>
                  )}
                </div>
              </>
            ) : (
              <div className="t-dim" style={{ fontSize: 12 }}>
                {riders.length ? "Cerca i tria quin rider necessita aquest concert." : "Aquest grup encara no té riders — crea'ls a la pestanya Riders del grup."}
              </div>
            )}
          </div>
          <div className="cd-material-col">
            <div className="cd-subtitle">Setlist del bolo</div>
            <select
              className="field-input form-field"
              value={setlistId}
              onChange={async (e) => {
                const v = e.target.value;
                setSetlistId(v);
                await setConcertMaterialAction(concert.id, "setlist", v || null);
                router.refresh();
              }}
            >
              <option value="">— Cap setlist assignada —</option>
              {setlists.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {selectedSetlist ? (
              <div className="cd-material-actions">
                <button type="button" className="btn-outline" onClick={() => window.open(`/m/${selectedSetlist.publicToken}`, "_blank")}>Obre / PDF</button>
                <button type="button" className="btn-outline" onClick={() => copyMaterial(selectedSetlist.publicToken)}>{materialCopied === selectedSetlist.publicToken ? "Copiat ✓" : "Copia enllaç"}</button>
                <button type="button" className="btn-outline cd-wa-btn" onClick={() => waMaterial(selectedSetlist.publicToken, "Setlist")}>WhatsApp</button>
              </div>
            ) : (
              <div className="t-dim" style={{ fontSize: 12 }}>
                {setlists.length ? "Tria la setlist d'aquest concert per poder-la enviar." : "Aquest grup encara no té setlists — crea-les a la pestanya Setlists del grup."}
              </div>
            )}
            {(kind === "assaig" || kind === "bolo") && selectedSetlist && (
              <div className="cd-highlights">
                <div className="cd-subtitle" style={{ marginTop: 14 }}>Cançons destacades d&apos;aquest {kind === "assaig" ? "assaig" : "concert"}</div>
                {selectedSetlist.songs.filter((s) => s.title.trim()).length === 0 ? (
                  <div className="t-dim" style={{ fontSize: 12 }}>Aquesta setlist encara no té cap cançó.</div>
                ) : (
                  <div className="cd-highlight-list">
                    {selectedSetlist.songs.filter((s) => s.title.trim()).map((s) => (
                      <label key={s.title} className={"cd-highlight-item" + (setlistHighlights[s.title] ? " on" : "")}>
                        <input type="checkbox" checked={!!setlistHighlights[s.title]} onChange={() => toggleHighlight(s.title)} />
                        {s.title}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </FoldPanel>
      )}

      {/* Facturació: cada bloc és un desplegable amb el resum a la capçalera */}
      {tab === "facturacio" && (
      <div className="cd-stack" id="cd-facturacio">
        <FoldPanel title="Client i factura" summary={invoice ? `${invoice.id} · ${invoice.state}` : "Sense factura"} defaultOpen>
        <div className="cd-fact-grid">
          <div className="cd-fact-col">
            <div className="cd-subtitle">Dades del client</div>
            <div className="cd-field">
              <label className="form-label">Client (sala / entitat)</label>
              <input className="field-input form-field" value={clientKey} disabled title="El client és la ubicació del concert" />
            </div>
            <div className="cd-field">
              <label className="form-label">Raó social</label>
              <input className="field-input form-field" value={clientForm.nom}
                onChange={(e) => setClientForm((p) => ({ ...p, nom: e.target.value }))}
                onBlur={async () => { await upsertClientDetailsAction(clientKey, "nom", clientForm.nom); router.refresh(); }} />
            </div>
            <div className="cd-field">
              <label className="form-label">CIF</label>
              <input className="field-input form-field" value={clientForm.cif}
                onChange={(e) => setClientForm((p) => ({ ...p, cif: e.target.value }))}
                onBlur={async () => { await upsertClientDetailsAction(clientKey, "cif", clientForm.cif); router.refresh(); }} />
            </div>
            <div className="cd-field">
              <label className="form-label">Adreça</label>
              <input className="field-input form-field" value={clientForm.address}
                onChange={(e) => setClientForm((p) => ({ ...p, address: e.target.value }))}
                onBlur={async () => { await upsertClientDetailsAction(clientKey, "address", clientForm.address); router.refresh(); }} />
            </div>
          </div>

          <div className="cd-fact-col">
            <div className="cd-subtitle">Factura</div>
            {invoice ? (
              <div className="cd-invoice-card">
                <div className="cd-invoice-head">
                  <button type="button" className="link-btn t-strong" onClick={() => setInvoicePreviewOpen(true)}>{invoice.id}</button>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {invoice.state !== "pagada" && (
                      <span className={"t-dim" + (daysOut > 30 ? " fin-neg" : "")} style={{ fontSize: 11.5 }} title="Dies des de l'emissió">
                        {daysOut} dies
                      </span>
                    )}
                    <select
                      className="field-input compact-field"
                      value={invoice.state}
                      onChange={async (e) => { await setInvoiceStateAction(invoice.id, e.target.value as "pagada" | "pendent" | "vençuda"); router.refresh(); }}
                    >
                      <option value="pendent">pendent</option>
                      <option value="pagada">pagada</option>
                      <option value="vençuda">vençuda</option>
                    </select>
                  </div>
                </div>

                {invEditOpen ? (
                  <div className="cd-invoice-edit">
                    <label>Base<input type="number" className="field-input compact-field" value={invEdit.base} onChange={(e) => setInvEdit({ ...invEdit, base: e.target.value })} /></label>
                    <label>IVA %<select className="field-input compact-field" value={invEdit.iva} onChange={(e) => setInvEdit({ ...invEdit, iva: e.target.value })}><option>21</option><option>10</option><option>0</option></select></label>
                    <label>IRPF %<select className="field-input compact-field" value={invEdit.irpf} onChange={(e) => setInvEdit({ ...invEdit, irpf: e.target.value })}><option>0</option><option>7</option><option>15</option></select></label>
                    <label>Bestreta<input type="number" className="field-input compact-field" value={invEdit.deposit} onChange={(e) => setInvEdit({ ...invEdit, deposit: e.target.value })} /></label>
                    <div style={{ display: "flex", gap: 8, gridColumn: "1 / -1" }}>
                      <button type="button" className="btn-outline" onClick={() => setInvEditOpen(false)}>Cancel·la</button>
                      <button type="button" className="btn-save" onClick={async () => {
                        await editInvoiceAction({
                          id: invoice.id, client: invoice.client, issueDate: invoice.issueDate, dueDate: invoice.dueDate,
                          baseAmount: parseInt(invEdit.base, 10) || 0, ivaRate: parseFloat(invEdit.iva) || 0,
                          irpfRate: parseFloat(invEdit.irpf) || 0, depositAmount: parseInt(invEdit.deposit, 10) || 0,
                          depositPaid: invoice.depositPaid,
                        });
                        setInvEditOpen(false);
                        router.refresh();
                      }}>Desa</button>
                    </div>
                  </div>
                ) : (
                  <div className="cd-invoice-rows">
                    <div><span className="t-dim">Base imposable</span><span>{formatCurrency(invoice.baseAmount)}</span></div>
                    <div><span className="t-dim">IVA {invoice.ivaRate}%</span><span>{formatCurrency(invTotals.iva)}</span></div>
                    {invoice.irpfRate > 0 && <div><span className="t-dim">Retenció IRPF {invoice.irpfRate}%</span><span className="fin-neg">−{formatCurrency(invTotals.irpf)}</span></div>}
                    <div className="t-strong"><span>Total</span><span>{formatCurrency(invoice.amount)}</span></div>
                    {invoice.depositAmount > 0 && (
                      <>
                        <div>
                          <span className="t-dim">Bestreta</span>
                          <span>
                            {formatCurrency(invoice.depositAmount)}{" "}
                            <button type="button" className="link-btn" style={{ fontSize: 11 }}
                              onClick={async () => {
                                await editInvoiceAction({
                                  id: invoice.id, client: invoice.client, issueDate: invoice.issueDate, dueDate: invoice.dueDate,
                                  baseAmount: invoice.baseAmount, ivaRate: invoice.ivaRate, irpfRate: invoice.irpfRate,
                                  depositAmount: invoice.depositAmount, depositPaid: !invoice.depositPaid,
                                });
                                router.refresh();
                              }}
                            >{invoice.depositPaid ? "cobrada ✓" : "marca cobrada"}</button>
                          </span>
                        </div>
                        <div><span className="t-dim">Resta pendent</span><span>{formatCurrency(invoice.amount - (invoice.depositPaid ? invoice.depositAmount : 0))}</span></div>
                      </>
                    )}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" className="btn-outline" onClick={() => setInvoicePreviewOpen(true)}>Visualitza / PDF</button>
                  {!invEditOpen && <button type="button" className="btn-outline" onClick={() => {
                    setInvEdit({ base: String(invoice.baseAmount), iva: String(invoice.ivaRate), irpf: String(invoice.irpfRate), deposit: String(invoice.depositAmount) });
                    setInvEditOpen(true);
                  }}>Edita</button>}
                </div>

                {invoice.state !== "pagada" && (
                  <div className="cd-reminder-row">
                    <input className="field-input compact-field" type="email" placeholder="correu del client…" value={reminderEmail} onChange={(e) => setReminderEmail(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
                    <button
                      type="button" className="btn-outline" disabled={!emailReady || !reminderEmail || reminding}
                      title={emailReady ? "Envia un recordatori amb el detall de la factura" : "Configura RESEND_API_KEY per enviar correus"}
                      onClick={async () => {
                        setReminding(true);
                        const res = await sendInvoiceReminderAction(invoice.id, reminderEmail);
                        setReminderStatus(res.ok ? "enviat ✓" : res.error || "error");
                        setReminding(false);
                      }}
                    >{reminderStatus || (reminding ? "Enviant…" : "Recordatori de cobrament")}</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="cd-invoice-card">
                <div className="cd-invoice-rows">
                  <div><span className="t-dim">Base imposable</span><span>{formatCurrency(amountNum)}</span></div>
                  <div><span className="t-dim">IVA {companyInfo.ivaRate}%</span><span>{formatCurrency(Math.round((amountNum * companyInfo.ivaRate) / 100))}</span></div>
                  {companyInfo.irpfRate > 0 && <div><span className="t-dim">Retenció IRPF {companyInfo.irpfRate}%</span><span className="fin-neg">−{formatCurrency(Math.round((amountNum * companyInfo.irpfRate) / 100))}</span></div>}
                  <div className="t-strong"><span>Total factura</span><span>{formatCurrency(computeInvoiceTotals(amountNum, companyInfo.ivaRate, companyInfo.irpfRate).total)}</span></div>
                </div>
                {!billing.caps.invoices ? (
                  <PlanLock billing={billing} feature="invoices" canUpgrade={canUpgrade} title="Factures amb numeració, IVA i recordatoris" description="Genera la factura d'aquest bolo amb un clic i porta el balanç al dia amb el pla Grup." />
                ) : cf.status === "confirmat" ? (
                  <button type="button" className="btn-save" disabled={generating} onClick={handleGenerateInvoice}>
                    {generating ? "Generant…" : "Genera la factura automàtica"}
                  </button>
                ) : (
                  <div className="t-dim" style={{ fontSize: 12 }}>Confirma el concert per generar la factura.</div>
                )}
              </div>
            )}

            {totalExpenses > 0 && (
              <div className="cd-margin-row">
                <span className="t-dim">Marge net del bolo</span>
                <span>
                  {formatCurrency(amountNum)} − {formatCurrency(totalExpenses)} despeses ={" "}
                  <strong className={amountNum - totalExpenses >= 0 ? "fin-pos" : "fin-neg"}>{formatCurrency(amountNum - totalExpenses)}</strong>
                </span>
              </div>
            )}

            {venueHistory.length > 0 && (
              <div className="cd-history">
                <div className="cd-subtitle" style={{ marginTop: 14 }}>Historial amb {clientKey}</div>
                {venueHistory.map((h, i) => (
                  <div key={i} className="cd-history-row">
                    <span className="t-dim">{formatDate(h.date)}</span>
                    <span>{formatCurrency(h.amount)}</span>
                    <span className={"badge"} style={h.invoiceState ? { background: statusColors(h.invoiceState).bg, color: statusColors(h.invoiceState).color } : {}}>
                      {h.invoiceState || "sense factura"}
                    </span>
                    {h.daysToPay !== null && <span className="t-dim" style={{ fontSize: 11 }}>{h.daysToPay}d termini</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        </FoldPanel>

        {/* Despeses: es resten del caixet abans de calcular el repartiment */}
        <FoldPanel title="Despeses" summary={expenseList.length ? `${expenseList.length} · ${formatCurrency(totalExpenses)}${expenseSaving ? " · desant…" : ""}` : "Cap despesa"} defaultOpen={expenseList.length > 0}>
        {expenseList.length > 0 && (
          <div className="cd-payout-list" style={{ marginBottom: 10 }}>
            {expenseList.map((t) => {
              const payer = expensePayer(t, agencyAssumesExpenses);
              return (
                <div key={t.id} className="cd-payout-row cd-expense-row">
                  <span className="cd-payout-name">{t.category}{t.notes ? " — " + t.notes : ""}</span>
                  <select
                    className="field-input compact-field cd-expense-payer" value={payer} title="Qui es fa càrrec d'aquesta despesa"
                    onChange={(e) => changeExpensePayer(t.id, e.target.value as ExpensePayer)}
                  >
                    {EXPENSE_PAYER_KEYS.map((k) => <option key={k} value={k}>{EXPENSE_PAYER_LABELS[k]}</option>)}
                  </select>
                  <span style={{ fontSize: 13 }} className={payer === "altre" ? "t-dim" : ""}>{formatCurrency(t.amount)}</span>
                  <button type="button" className="row-delete-btn" title="Elimina la despesa" onClick={() => removeExpense(t.id)}>✕</button>
                </div>
              );
            })}
            <div className="cd-payout-total">
              <span>Total despeses del bolo</span>
              <span>{formatCurrency(totalExpenses)}</span>
            </div>
            {expenseSplit.altre > 0 && (
              <div className="t-dim" style={{ fontSize: 12 }}>+ {formatCurrency(expenseSplit.altre)} a càrrec d&apos;altres (no compten al repartiment)</div>
            )}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text" className="field-input compact-field" style={{ width: 180 }}
            placeholder="Benzina, dietes…"
            value={expenseForm.title}
            onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
          />
          <input
            type="number" min={0} className="field-input compact-field cd-payout-input" style={{ width: 100 }}
            placeholder="import €"
            value={expenseForm.amount}
            onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
          />
          <select
            className="field-input compact-field cd-expense-payer" value={expenseForm.payer} title="Qui es fa càrrec d'aquesta despesa"
            onChange={(e) => setExpenseForm({ ...expenseForm, payer: e.target.value as ExpensePayer })}
          >
            {EXPENSE_PAYER_KEYS.map((k) => <option key={k} value={k}>A càrrec de: {EXPENSE_PAYER_LABELS[k]}</option>)}
          </select>
          <button type="button" className="btn-outline" disabled={expenseSaving || !expenseForm.title.trim() || !(parseInt(expenseForm.amount, 10) || 0)} onClick={addExpense}>+ Afegeix despesa</button>
        </div>
        <div className="t-dim" style={{ fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>
          <strong>Agència</strong>: es descompta de la seva comissió · <strong>Grup</strong>: del repartiment de músics i crew ·{" "}
          <strong>Agència i grup</strong>: del caixet, abans de calcular res · <strong>Altres</strong>: la paga algú altre (promotor, sala…) i no compta.
        </div>

        </FoldPanel>

        {/* Comissió de l'agència: sempre a part, mai barrejada amb el
            repartiment de músics i crew. */}
        <FoldPanel title="Comissió de l'agència" summary={`${formatCurrency(agencyAmt || 0)}${agencyPct != null ? ` · ${round2(agencyPct)} %` : ""}${payoutsSaving ? " · desant…" : ""}`} defaultOpen={false}>
        <div className="cd-payout-list" style={{ maxWidth: 400 }}>
          <div className="cd-payout-row cd-payout-row-agency">
            <span className="cd-payout-agency-icon" aria-hidden="true">🏢</span>
            <span className="cd-payout-name">{AGENCY_PAYOUT_NAME}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <input
                type="number" min={0} step={0.01} className="field-input compact-field cd-payout-input"
                value={agencyAmt ?? ""}
                placeholder="0"
                onChange={(e) => editAgencyAmount(parseFloat(e.target.value) || 0)}
              />
              <span className="t-dim" style={{ fontSize: 12 }}>€</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, width: 56 }}>
              <input
                type="number" min={0} className="field-input compact-field cd-payout-pct-input"
                style={{ width: 44, textAlign: "right", fontSize: 12 }}
                value={agencyPct != null ? round2(agencyPct) : ""}
                placeholder="0"
                title="Percentatge fix sobre el caixet net de despeses compartides — no varia encara que canviïn les despeses o el caixet"
                onChange={(e) => editAgencyPct(parseInt(e.target.value, 10) || 0)}
              />
              <span className="t-dim" style={{ fontSize: 12 }}>%</span>
            </div>
          </div>
        </div>
        {/* Desglossament: d'on surt la comissió, què hi resta l'agència en
            despeses, i què queda per al grup (i quin % del caixet és). */}
        <div className="cd-comm-breakdown">
          <div>
            <span className="t-dim">Base de la comissió</span>
            <span>
              {formatCurrency(sharedNet)}
              {expenseSplit.ambdos > 0 && <span className="t-dim"> · caixet − {formatCurrency(expenseSplit.ambdos)} de despeses compartides</span>}
            </span>
          </div>
          <div><span className="t-dim">Comissió ({round2(agencyPct)} %)</span><span>{formatCurrency(agencyAmt)}</span></div>
          {expenseSplit.agencia > 0 && (
            <div><span className="t-dim">Despeses a càrrec de l&apos;agència</span><span className="fin-neg">−{formatCurrency(expenseSplit.agencia)}</span></div>
          )}
          <div className="t-strong">
            <span>Net per a l&apos;agència</span>
            <span className={agencyNet >= 0 ? "fin-pos" : "fin-neg"}>{formatCurrency(agencyNet)}</span>
          </div>
          <div className="cd-comm-sep"></div>
          <div>
            <span className="t-dim">Queda per al grup</span>
            <span><strong>{formatCurrency(bandPool)}</strong><span className="t-dim"> · {amountNum ? Math.round((bandPool / amountNum) * 100) : 0} % del caixet</span></span>
          </div>
          {expenseSplit.grup > 0 && (
            <div><span className="t-dim">Despeses a càrrec del grup (ja descomptades)</span><span className="fin-neg">−{formatCurrency(expenseSplit.grup)}</span></div>
          )}
        </div>

        </FoldPanel>

        {/* Repartiment entre músics i crew: el 100% és el que quedi un cop
            tret el tall de l'agència. */}
        <FoldPanel title="Repartiment entre músics i crew" summary={bandNames.length ? `${bandNames.length} persones · ${formatCurrency(bandTotal)} de ${formatCurrency(bandPool)}` : "Sense participants"} defaultOpen={false}>
        <div className="cd-subtitle" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          <span className="t-dim" style={{ fontWeight: 400 }}>Imports o percentatges de cadascú</span>
          <button type="button" className="link-btn" onClick={equalSplit}>reparteix a parts iguals</button>
          {band && (
            <button type="button" className="link-btn" disabled={savingDefaultSplit} onClick={saveAsDefaultSplit}>
              {defaultSplitSaved ? "Desat com a predeterminat ✓" : savingDefaultSplit ? "Desant…" : "Marca aquestes proporcions com a predeterminades"}
            </button>
          )}
        </div>
        {expenseSplit.grup > 0 && (
          <div className="t-dim" style={{ fontSize: 12.5, marginBottom: 8 }}>
            Despeses a càrrec del grup: <span className="fin-neg">−{formatCurrency(expenseSplit.grup)}</span> — ja descomptades del que es reparteix ({formatCurrency(bandPool)}).
          </div>
        )}
        {bandNames.length === 0 ? (
          <div className="t-dim" style={{ fontSize: 13 }}>Sense participants: marca l&apos;assistència per repartir.</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
              <PayoutDonut
                segments={[
                  { color: "rgba(255,255,255,0.14)", pct: amountNum ? (totalExpenses / amountNum) * 100 : 0, label: "Despeses" },
                  { color: "rgba(255,255,255,0.32)", pct: amountNum ? (Math.max(0, agencyNet) / amountNum) * 100 : 0, label: AGENCY_PAYOUT_NAME },
                  ...bandNames.map((n, i) => ({
                    color: `oklch(0.68 0.16 ${(i * 47 + 250) % 360})`,
                    pct: amountNum ? ((payouts[n] || 0) / amountNum) * 100 : 0,
                    label: n,
                  })),
                ]}
              />
              <div className="cd-payout-list" style={{ flex: 1, minWidth: 260 }}>
                {bandNames.map((n, i) => {
                  const person = payoutPersonByName[n];
                  const roleLabel = person?.instruments?.length ? person.instruments.join(", ") : person?.role || "";
                  const color = `oklch(0.68 0.16 ${(i * 47 + 250) % 360})`;
                  return (
                    <div key={n} className="cd-payout-row">
                      <span className="cd-payout-dot" style={{ background: color }}></span>
                      <img className="member-photo" style={{ width: 28, height: 28, borderRadius: 8 }} src={photosByName[normalize(n)] ? `/api/file/${photosByName[normalize(n)]}` : personPhotoDataUri(n)} alt="" />
                      <span className="cd-payout-name">
                        {n}
                        {linkedByName[n] && <VerifiedTick size={12} />}
                        {roleLabel && <span className="cd-payout-role t-dim"> · {roleLabel}</span>}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <input
                          type="number" min={0} step={0.01} className="field-input compact-field cd-payout-input"
                          value={payouts[n] ?? ""}
                          placeholder="0"
                          onChange={(e) => editPayout(n, parseFloat(e.target.value) || 0)}
                          onBlur={() => persistPayouts(payouts)}
                        />
                        <span className="t-dim" style={{ fontSize: 12 }}>€</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, width: 56 }}>
                        <input
                          type="number" min={0} className="field-input compact-field cd-payout-pct-input"
                          style={{ width: 44, textAlign: "right", fontSize: 12 }}
                          value={bandPool ? Math.round(((payouts[n] || 0) / bandPool) * 100) : ""}
                          placeholder="0"
                          title="Percentatge del repartiment entre músics i crew (un cop tret el tall de l'agència)"
                          onChange={(e) => editPayout(n, ((parseInt(e.target.value, 10) || 0) / 100) * bandPool)}
                          onBlur={() => persistPayouts(payouts)}
                        />
                        <span className="t-dim" style={{ fontSize: 12 }}>%</span>
                      </div>
                    </div>
                  );
                })}
                <div className="cd-payout-total">
                  <span>Total repartit</span>
                  <span className={bandTotal > bandPool + 0.01 ? "cd-payout-over" : ""}>{formatCurrency(bandTotal)} / {formatCurrency(bandPool)}</span>
                </div>
              </div>
            </div>
            <div className="t-dim" style={{ fontSize: 12, marginTop: 8 }}>
              Els pagaments dins de l&apos;app arribaran més endavant — de moment aquest repartiment és el full de càlcul de referència. El 100% és el caixet menys les despeses compartides i les del grup, i menys la comissió de l&apos;agència.
            </div>
          </>
        )}
        </FoldPanel>

        {/* Contracte d'actuació: amb les dades del concert, per enviar al client */}
        <FoldPanel title="Contracte" summary={<><span className="beta-badge">Beta</span>{!billing.caps.contracts ? "Pla Grup" : concert.contract ? (concert.contractToken ? "Generat · amb enllaç" : "Redactat") : "Properament"}</>} defaultOpen={false}>
          <div className="beta-note">
            <span aria-hidden="true">🚧</span>
            <div>
              <strong>En fase beta — properament.</strong> El contracte d&apos;actuació encara l&apos;estem acabant: ja es pot redactar, previsualitzar i
              compartir, però revisa&apos;l bé abans d&apos;enviar-lo a un client.
            </div>
          </div>
          {billing.caps.contracts ? (
            <ContractPanel concert={liveConcert} companyInfo={companyInfo} client={{ name: clientKey, nom: clientForm.nom, cif: clientForm.cif, address: clientForm.address }} emailReady={emailReady} />
          ) : (
            <PlanLock billing={billing} feature="contracts" canUpgrade={canUpgrade} title="Contracte d'actuació amb les dades del bolo" description="Clàusules ja redactades, PDF i enllaç per enviar al client. Inclòs al pla Grup." />
          )}
        </FoldPanel>
      </div>
      )}

      {/* Comparteix: a Informació i també al final del Full de ruta */}
      {(tab === "info" || tab === "ruta") && (
      <FoldPanel id="cd-comparteix" title="Comparteix — formularis per omplir dades" summary={shareLinks.length ? `${shareLinks.length} ${shareLinks.length === 1 ? "enllaç" : "enllaços"}${activeLinks.cap != null ? ` · ${activeLinks.count}/${activeLinks.cap} actius al pla gratuït` : ""}` : "Cap enllaç"} defaultOpen={shareLinks.length > 0 || newLinkOpen}
        action={!newLinkOpen && (activeLinks.reached
          ? <PlanLock billing={billing} required="grup" compact canUpgrade={canUpgrade} title={`Has arribat als ${activeLinks.cap} enllaços actius del pla gratuït`} />
          : <button type="button" className="glow-cta" onClick={() => setNewLinkOpen(true)}>+ Nou enllaç</button>)}>
        <div className="t-dim" style={{ fontSize: 13, marginBottom: 14 }}>
          Genera un enllaç caducable perquè l&apos;ajuntament, el promotor o la sala omplin la informació que falta.
          El formulari es pot editar mentre l&apos;enllaç sigui vàlid, encara que ja s&apos;hagi enviat.
        </div>

        {newLinkOpen && (
          <div className="cd-newlink">
            <div className="cd-newlink-scopes">
              {(["info", "ruta", "both"] as const).map((s) => (
                <button key={s} type="button" className={"cd-scope-card" + (linkScope === s ? " active" : "")} onClick={() => setLinkScope(s)}>
                  <div className="cd-scope-title">{scopeLabels[s]}</div>
                  <div className="cd-scope-desc">
                    {s === "info" ? "Data, lloc, festa i import" : s === "ruta" ? "Horaris, contactes, hospitalitat, tècnica" : "Tot el formulari complet"}
                  </div>
                </button>
              ))}
            </div>
            <div className="cd-newlink-fields">
              <div className="cd-field">
                <label className="form-label">Nom del destinatari</label>
                <input className="field-input form-field" value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder="Maria (Aj. de Reus)" />
              </div>
              <div className="cd-field">
                <label className="form-label">Correu electrònic</label>
                <input className="field-input form-field" type="email" value={linkEmail} onChange={(e) => setLinkEmail(e.target.value)} placeholder="cultura@ajuntament.cat" />
              </div>
              <div className="cd-field">
                <label className="form-label">Validesa</label>
                <select className="field-input form-field" value={linkDays} onChange={(e) => setLinkDays(parseInt(e.target.value, 10))}>
                  <option value={7}>7 dies</option>
                  <option value={14}>14 dies</option>
                  <option value={30}>30 dies</option>
                  <option value={60}>60 dies</option>
                  <option value={Math.max(1, Math.min(90, Math.ceil((new Date(concert.date + "T00:00:00").getTime() - Date.now()) / 86400000)))}>
                    Fins al dia de l&apos;actuació
                  </option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="btn-outline" onClick={() => setNewLinkOpen(false)}>Cancel·la</button>
              <button type="button" className="btn-save" disabled={creatingLink} onClick={handleCreateLink}>
                {creatingLink ? "Creant…" : "Crea l'enllaç"}
              </button>
            </div>
          </div>
        )}

        {lastCreatedUrl && (
          <div className="cd-created-banner">
            Enllaç creat: <code>{lastCreatedUrl}</code>
          </div>
        )}

        {shareLinks.length === 0 && !newLinkOpen ? (
          <div className="t-dim" style={{ fontSize: 13 }}>Encara no hi ha cap enllaç per aquest concert.</div>
        ) : (
          <div className="cd-links-list">
            {shareLinks.map((l) => {
              const st = shareLinkStatus(l);
              return (
                <div key={l.id} className={"cd-link-card" + (st !== "activa" ? " inactive" : "")}>
                  <div className="cd-link-main">
                    <div className="cd-link-title">
                      <span className="badge" style={{ background: "oklch(0.68 0.19 290 / 0.16)", color: "var(--accent-text)" }}>{scopeLabels[l.scope]}</span>
                      <span className={"cd-link-status " + st}>{st}</span>
                      {l.submittedAt && <span className="cd-link-status activa">respost ✓</span>}
                      {l.lastOpenedAt && !l.submittedAt && <span className="t-dim" style={{ fontSize: 11 }}>obert</span>}
                    </div>
                    <div className="t-dim" style={{ fontSize: 12 }}>
                      {l.recipientName || l.recipientEmail || "Sense destinatari"} · caduca {new Date(l.expiresAt).toLocaleDateString("ca-ES")}
                      {l.emailSentAt ? " · correu enviat" : ""}
                    </div>
                  </div>
                  {st === "activa" && (
                    <div className="cd-link-actions">
                      <button type="button" className="btn-outline" onClick={() => copyLink(l.id)}>{copied === l.id ? "Copiat ✓" : "Copia"}</button>
                      <button type="button" className="btn-outline cd-wa-btn" onClick={() => whatsappLink(l)}>WhatsApp</button>
                      {l.recipientEmail && (
                        <button
                          type="button" className="btn-outline" disabled={!emailReady}
                          title={emailReady ? `Envia a ${l.recipientEmail}` : "Configura RESEND_API_KEY per enviar correus des d'Escenari"}
                          onClick={() => handleSendEmail(l.id)}
                        >{emailStatus[l.id] || "Envia per correu"}</button>
                      )}
                      <button type="button" className="row-delete-btn" title="Revoca l'enllaç" onClick={async () => { await revokeShareLinkAction(l.id); router.refresh(); }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </FoldPanel>
      )}

      {/* Zona de perill: eliminar l'esdeveniment sencer */}
      <div className="panel cd-section cd-danger-zone">
        <div>
          <div className="panel-title" style={{ marginBottom: 4 }}>Elimina aquest {kind === "bolo" ? "concert" : "esdeveniment"}</div>
          <div className="t-dim" style={{ fontSize: 12.5 }}>S&apos;esborra del tot, amb el full de ruta, el repartiment i la factura que hi hagi. No es pot desfer.</div>
        </div>
        <button type="button" className="btn-danger-outline" onClick={() => setDeleteOpen(true)}>Elimina</button>
      </div>
      {deleteOpen && (
        <ConfirmDialog
          title={kind === "bolo" ? "Eliminar el concert?" : "Eliminar l'esdeveniment?"}
          message={<>S&apos;eliminarà <strong>{cf.festaEntitat || cf.city || cf.venue || capitalize(formatDateFull(cf.date))}</strong> ({capitalize(formatDateFull(cf.date))}) amb tot el que hi ha a dins. No es pot desfer.</>}
          confirmLabel="Elimina" busy={deleting}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={async () => {
            setDeleting(true);
            await deleteConcertAction(concert.id);
            router.push("/concerts");
            router.refresh();
          }}
        />
      )}

      {rsPreviewOpen && (
        <RouteSheetPreview concert={concert} onClose={() => setRsPreviewOpen(false)} onEdit={() => setRsPreviewOpen(false)} />
      )}
      {invoicePreviewOpen && invoice && (
        <InvoicePreview invoice={invoice} concert={concert} companyInfo={companyInfo} onClose={() => setInvoicePreviewOpen(false)} />
      )}
      {posterOpen && (
        <ConcertPosterModal concert={liveConcert} band={band} onClose={() => setPosterOpen(false)} />
      )}
      {attModal && (
        <AttendanceLinkModal
          concert={concert} others={attModal.others} intent={attModal.intent}
          onClose={() => setAttModal(null)}
          onDone={(token, multi) => {
            const intent = attModal.intent;
            if (!multi) setAttToken(token);
            setAttModal(null);
            void runAttIntent(intent, token, multi);
          }}
        />
      )}
    </div>
  );
}
