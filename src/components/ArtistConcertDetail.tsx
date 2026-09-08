"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Band, Concert } from "@/lib/types";
import type { Setlist } from "@/lib/material-types";
import { setConcertMaterialAction } from "@/app/(app)/grup/material-actions";
import { formatCurrency, formatDateFull, capitalize, formatDate, statusColors, formatConcertTime } from "@/lib/format";
import { personPhotoDataUri, instrumentsFor, instrumentIconFor } from "@/lib/tags";
import { normalize } from "@/lib/text";
import { rsCompletionPercent } from "@/lib/route-sheet";
import { EXPENSE_PAYER_LABELS } from "@/lib/finance";
import { AGENCY_PAYOUT_NAME, type PayoutSummary } from "@/lib/payouts";
import RouteSheetPreview from "@/components/RouteSheetPreview";
import RouteSheetPreviewDoc from "@/components/RouteSheetPreviewDoc";
import AttendanceButtons from "@/app/(artist)/artista/AttendanceButtons";
import VerifiedTick from "@/components/VerifiedTick";
import BackLink from "@/components/BackLink";
import DiaTopActions from "@/components/DiaTopActions";

const KIND_LABELS: Record<string, string> = { bolo: "Bolo", assaig: "Assaig", reunio: "Reunió", altre: "Esdeveniment" };

type Tab = "info" | "ruta" | "assistencia" | "diners";

// Fitxa del concert per al músic: la mateixa portada de pòster que el gestor
// (amb compartir i, per als admins del grup, el full de ruta), informació,
// assistència i diners — un admin ho veu tot (caixet, despeses, comissió i
// repartiment sencer, només lectura); la resta, només el que els toca.
export default function ArtistConcertDetail({ concert, band, myName, myAmount, showFees, isAdmin = false, money = null, photosByName = {}, setlists = [], canSetlists = false, linkedNames = [], today }: {
  concert: Concert;
  band: Band | null;
  myName: string;
  myAmount: number | null; // null = no forma part del repartiment
  showFees: boolean;       // el grup mostra el caixet total als membres
  isAdmin?: boolean;
  money?: PayoutSummary | null; // només per als admins: tot el desglossament
  photosByName?: Record<string, string>;
  setlists?: Setlist[];
  canSetlists?: boolean; // amb el permís "Setlists" pot triar-la des d'aquí
  linkedNames?: string[]; // membres amb compte d'Escenari vinculat (tick lila)
  today: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("info");
  const [rsOpen, setRsOpen] = useState(false);
  const [setlistId, setSetlistId] = useState<string>(concert.setlistId || "");
  const selectedSetlist = setlists.find((s) => s.id === setlistId) || null;
  const accent = band?.color1 || "#8b7bff";
  const sc = statusColors(concert.status);
  const members = band?.members || [];
  const attendance = concert.attendance || {};
  const rsPct = rsCompletionPercent(concert);
  const isFuture = concert.date >= today;
  const myAnswer = attendance[myName] === "yes" ? "yes" : attendance[myName] === "no" ? "no" : null;
  const linkedSet = new Set(linkedNames.map(normalize));
  const kind = concert.kind || "bolo";
  const amountShown = money ? money.amount : showFees ? concert.amount : 0;
  const mapsQuery = encodeURIComponent([concert.venue, concert.address, concert.city].filter(Boolean).join(", "));

  const tabs: [Tab, string][] = [
    ["info", "Informació"],
    ...(isAdmin ? ([["ruta", "Full de ruta"]] as [Tab, string][]) : []),
    ["assistencia", "Assistència"],
    ["diners", isAdmin ? "Diners" : "El meu caixet"],
  ];

  const infoRows: [string, string][] = [
    ["Tipus", KIND_LABELS[kind] || "Bolo"],
    ["Data", capitalize(formatDateFull(concert.date))],
    ["Hora", concert.exactTime ? `${concert.exactTime}h` : concert.time ? formatConcertTime(concert.time) : "—"],
    ["Població", concert.city ? concert.city.split(",")[0] : "—"],
    ["Ubicació", concert.venue || "—"],
    ["Adreça", concert.address || "—"],
    ["Festa / entitat", concert.festaEntitat || "—"],
  ];

  const personRow = (n: string, extra?: React.ReactNode) => (
    <div key={n} className="acd-money-row">
      <img className="member-photo" style={{ width: 26, height: 26, borderRadius: 8 }} src={photosByName[normalize(n)] ? `/api/file/${photosByName[normalize(n)]}` : personPhotoDataUri(n)} alt="" />
      <span className="acd-money-name">{n}{linkedSet.has(normalize(n)) && <VerifiedTick size={12} />}{normalize(n) === normalize(myName) ? <span className="t-dim"> (tu)</span> : null}</span>
      {extra}
    </div>
  );

  return (
    <div className="glow concert-detail" style={{ ["--band-accent" as string]: accent }}>
      <div className="glow-blooms" aria-hidden="true"></div>

      <div className="cd-topbar">
        <BackLink href="/artista/concerts">Concerts</BackLink>
        {isAdmin && <span className="badge" style={{ background: "oklch(0.68 0.19 290 / 0.16)", color: "var(--accent-text)" }}>Admin del grup</span>}
      </div>

      {/* Pòster — el mateix que a la fitxa del gestor */}
      <div className="cd-poster">
        <div className="cd-poster-glow" aria-hidden="true"></div>
        <div className="cd-poster-kicker">{concert.bandName}</div>
        <div className="cd-poster-subtitle">
          {concert.festaEntitat || (kind === "bolo" ? "concert" : kind === "reunio" ? "reunió" : kind)}
        </div>
        {concert.city && <div className="cd-poster-title">{concert.city.split(",")[0]}</div>}
        {concert.venue && (
          <a className="cd-poster-place" href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`} target="_blank" rel="noreferrer" title="Obre la ubicació a Google Maps">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            {concert.venue}
          </a>
        )}
        <div className="cd-poster-date">{capitalize(formatDateFull(concert.date))}{concert.exactTime ? ` — ${concert.exactTime}` : concert.time ? ` — ${formatConcertTime(concert.time)}` : ""}</div>
        <div className="cd-poster-foot">
          <span className="badge" style={{ background: sc.bg, color: sc.color }}>{concert.status}</span>
          {amountShown > 0 && <div className="cd-hero-amount">{formatCurrency(amountShown)}</div>}
          {isFuture && myName && (
            <AttendanceButtons concertId={concert.id} current={myAnswer} />
          )}
          <div className="cd-poster-actions">
            {/* Compartir (Instagram / WhatsApp) i, només per als admins, el full de ruta. */}
            <DiaTopActions concert={concert} band={band} base="/artista" iconBtnClass="cd-poster-icon-btn" showRouteSheet={isAdmin} />
          </div>
        </div>
      </div>

      <div className="stats-tabs cd-tabs">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" className={"stats-tab" + (tab === k ? " active" : "")} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === "info" && (
        <div className="panel cd-section">
          <div className="panel-title cd-section-title">Informació</div>
          <div className="acd-info-rows">
            {infoRows.map(([label, value]) => (
              <div key={label} className="acd-info-row">
                <span className="t-dim">{label}</span>
                <span className="t-strong">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Setlist de l'esdeveniment: es veu sempre; es tria des d'aquí amb el
          permís "Setlists" (o des de la setlist mateixa, al grup). */}
      {tab === "info" && (
        <div className="panel cd-section">
          <div className="panel-title cd-section-title">Setlist</div>
          {canSetlists && (
            <select
              className="field-input compact-field" style={{ maxWidth: 360 }}
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
          )}
          {selectedSetlist ? (
            <div className="cd-material-actions" style={{ marginTop: canSetlists ? 10 : 0, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="t-strong" style={{ fontSize: 13.5 }}>{selectedSetlist.name}</span>
              <span className="t-dim" style={{ fontSize: 12 }}>{selectedSetlist.songs.filter((x) => x.title.trim()).length} cançons</span>
              <button type="button" className="btn-outline stage-mode-btn" onClick={() => router.push(`/escenari-mode/${selectedSetlist.id}?concert=${concert.id}`)}>▶ Escenari</button>
              <button type="button" className="btn-outline" onClick={() => window.open(`/m/${selectedSetlist.publicToken}`, "_blank")}>Obre / PDF</button>
            </div>
          ) : (
            !canSetlists && <div className="t-dim" style={{ fontSize: 13 }}>Cap setlist assignada a aquest esdeveniment.</div>
          )}
        </div>
      )}

      {tab === "ruta" && isAdmin && (
        <div className="panel cd-section">
          <div className="panel-header-row cd-section-title">
            <div className="panel-title">Full de ruta</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="t-dim" style={{ fontSize: 12 }}>{rsPct}% complet</span>
              <button type="button" className="btn-save" onClick={() => setRsOpen(true)}>Obre / genera PDF</button>
            </div>
          </div>
          {concert.routeSheet ? (
            <div className="acd-rs-inline">
              <RouteSheetPreviewDoc concert={concert} />
            </div>
          ) : (
            <div className="t-dim" style={{ fontSize: 13 }}>El gestor encara no ha omplert el full de ruta d&apos;aquest bolo.</div>
          )}
        </div>
      )}

      {tab === "assistencia" && (
        <div className="panel cd-section">
          <div className="panel-header-row cd-section-title">
            <div className="panel-title">Assistència</div>
            <div className="t-dim" style={{ fontSize: 12 }}>
              {members.filter((m) => attendance[m.name] === "yes").length}/{members.length} confirmats
            </div>
          </div>
          <div className="cd-attendance-list">
            {members.map((m) => {
              const att = attendance[m.name];
              const inss = instrumentsFor(m);
              return (
                <div key={m.name} className={"cd-att-row" + (att === "no" ? " att-no" : att === "yes" ? " att-yes" : "")}>
                  <img className="member-photo backup-photo" src={photosByName[normalize(m.name)] ? `/api/file/${photosByName[normalize(m.name)]}` : personPhotoDataUri(m.name)} alt="" />
                  <div className="cd-att-main">
                    <div className="member-name">{m.name}{m.name === myName ? " (tu)" : ""}{linkedSet.has(normalize(m.name)) && <VerifiedTick size={12} />}</div>
                    <div className="member-instruments">
                      {inss.slice(0, 3).map((ins) => {
                        const icon = instrumentIconFor(ins);
                        return <span key={ins} className="member-instrument-chip">{icon && <img src={icon} alt="" />}{ins}</span>;
                      })}
                    </div>
                  </div>
                  <span className={"cfm-badge " + (att === "yes" ? "yes" : att === "no" ? "no" : "pending")}>
                    {att === "yes" ? "Hi serà ✓" : att === "no" ? "No hi serà" : "Pendent"}
                  </span>
                </div>
              );
            })}
            {members.length === 0 && <div className="t-dim" style={{ fontSize: 13 }}>Sense membres assignats.</div>}
          </div>
        </div>
      )}

      {tab === "diners" && (
        <div className="panel cd-section">
          <div className="panel-title cd-section-title">{isAdmin ? "Diners" : "El meu caixet"}</div>
          {!isAdmin ? (
            myAmount === null ? (
              <div className="t-dim" style={{ fontSize: 13.5 }}>
                No formes part del repartiment d&apos;aquest bolo{attendance[myName] === "no" ? " (has dit que no hi seràs)" : ""}.
              </div>
            ) : (
              <div className="acd-payout">
                <div className="acd-payout-amount">{formatCurrency(myAmount)}</div>
                <div className="t-dim" style={{ fontSize: 12.5 }}>
                  El que et toca del bolo del {formatDate(concert.date)}. Només lectura — el repartiment el fa el gestor.
                  {!showFees && " El grup no mostra el caixet total als membres."}
                </div>
              </div>
            )
          ) : money && (
            <div className="acd-money">
              <div className="kpi-grid">
                <div className="card card-centered"><div className="card-title">Caixet</div><div className="card-value">{formatCurrency(money.amount)}</div></div>
                <div className="card card-centered"><div className="card-title">Despeses</div><div className="card-value">{formatCurrency(money.totalExpenses)}</div></div>
                <div className="card card-centered"><div className="card-title">Agència ({Math.round(money.agencyPct * 100) / 100} %)</div><div className="card-value">{formatCurrency(money.agencyNet)}</div></div>
                <div className="card card-centered"><div className="card-title">Per al grup</div><div className="card-value">{formatCurrency(money.bandPool)}</div></div>
                {myAmount !== null && <div className="card card-centered"><div className="card-title">El que et toca</div><div className="card-value">{formatCurrency(myAmount)}</div></div>}
              </div>

              {money.expenseList.length > 0 && (
                <div className="acd-money-block">
                  <div className="cd-subtitle">Despeses</div>
                  {money.expenseList.map((e) => (
                    <div key={e.id} className="acd-money-row">
                      <span className="acd-money-name">{e.label}</span>
                      <span className="badge">{EXPENSE_PAYER_LABELS[e.payer]}</span>
                      <span className={"acd-money-amt" + (e.payer === "altre" ? " t-dim" : "")}>{formatCurrency(e.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="acd-money-block">
                <div className="cd-subtitle">Comissió de l&apos;agència</div>
                <div className="acd-money-row"><span className="acd-money-name t-dim">Base (caixet − despeses compartides)</span><span className="acd-money-amt">{formatCurrency(money.sharedNet)}</span></div>
                <div className="acd-money-row"><span className="acd-money-name t-dim">Comissió ({Math.round(money.agencyPct * 100) / 100} %)</span><span className="acd-money-amt">{formatCurrency(money.agencyAmt)}</span></div>
                {money.expenses.agencia > 0 && <div className="acd-money-row"><span className="acd-money-name t-dim">Despeses a càrrec de l&apos;agència</span><span className="acd-money-amt fin-neg">−{formatCurrency(money.expenses.agencia)}</span></div>}
                <div className="acd-money-row t-strong"><span className="acd-money-name">Net per a l&apos;agència</span><span className="acd-money-amt">{formatCurrency(money.agencyNet)}</span></div>
                <div className="acd-money-row"><span className="acd-money-name t-dim">Queda per al grup</span><span className="acd-money-amt"><strong>{formatCurrency(money.bandPool)}</strong>{money.amount > 0 && <span className="t-dim"> · {Math.round((money.bandPool / money.amount) * 100)} % del caixet</span>}</span></div>
              </div>

              <div className="acd-money-block">
                <div className="cd-subtitle">Repartiment entre músics i crew</div>
                {Object.entries(money.payouts).filter(([n]) => n !== AGENCY_PAYOUT_NAME).map(([n, v]) =>
                  personRow(n, <span className="acd-money-amt">{formatCurrency(v)}</span>)
                )}
                {Object.keys(money.payouts).filter((n) => n !== AGENCY_PAYOUT_NAME).length === 0 && (
                  <div className="t-dim" style={{ fontSize: 13 }}>Encara no hi ha ningú al repartiment.</div>
                )}
                {!money.saved && (
                  <div className="t-dim" style={{ fontSize: 12, marginTop: 8 }}>Repartiment predeterminat (parts iguals) — el gestor encara no l&apos;ha ajustat a mà.</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {rsOpen && (
        <RouteSheetPreview concert={concert} onClose={() => setRsOpen(false)} onEdit={() => setRsOpen(false)} />
      )}
    </div>
  );
}
