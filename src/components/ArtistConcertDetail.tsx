"use client";

import { useState } from "react";
import Link from "next/link";
import type { Band, Concert } from "@/lib/types";
import { formatCurrency, formatDateFull, capitalize, formatDate, statusColors } from "@/lib/format";
import { personPhotoDataUri, instrumentsFor, instrumentIconFor } from "@/lib/tags";
import { normalize } from "@/lib/text";
import { rsCompletionPercent } from "@/lib/route-sheet";
import RouteSheetPreview from "@/components/RouteSheetPreview";
import RouteSheetPreviewDoc from "@/components/RouteSheetPreviewDoc";
import AttendanceButtons from "@/app/(artist)/artista/AttendanceButtons";

const KIND_LABELS: Record<string, string> = { bolo: "Bolo", assaig: "Assaig", reunio: "Reunió", altre: "Esdeveniment" };

// Fitxa del concert per al músic: mateixa portada de pòster que el gestor,
// però tot de només lectura — informació, full de ruta (amb PDF), assistència
// i, de facturació, només el seu caixet.
export default function ArtistConcertDetail({ concert, band, myName, myAmount, showFees, photosByName = {}, today }: {
  concert: Concert;
  band: Band | null;
  myName: string;
  myAmount: number | null; // null = el grup no mostra caixets
  showFees: boolean;
  photosByName?: Record<string, string>;
  today: string;
}) {
  const [tab, setTab] = useState<"info" | "ruta" | "assistencia" | "caixet">("info");
  const [rsOpen, setRsOpen] = useState(false);
  const accent = band?.color1 || "#8b7bff";
  const sc = statusColors(concert.status);
  const members = band?.members || [];
  const attendance = concert.attendance || {};
  const rsPct = rsCompletionPercent(concert);
  const isFuture = concert.date >= today;
  const myAnswer = attendance[myName] === "yes" ? "yes" : attendance[myName] === "no" ? "no" : null;

  const infoRows: [string, string][] = [
    ["Tipus", KIND_LABELS[concert.kind || "bolo"] || "Bolo"],
    ["Data", capitalize(formatDateFull(concert.date))],
    ["Hora", concert.time ? `${concert.time}h` : "—"],
    ["Població", concert.city ? concert.city.split(",")[0] : "—"],
    ["Ubicació", concert.venue || "—"],
    ["Festa / entitat", concert.festaEntitat || "—"],
  ];

  return (
    <div className="glow concert-detail" style={{ ["--band-accent" as string]: accent }}>
      <div className="glow-blooms" aria-hidden="true"></div>

      <div className="cd-topbar">
        <Link href="/artista/concerts" className="cd-back">← Concerts</Link>
      </div>

      {/* Pòster */}
      <div className="cd-poster">
        <div className="cd-poster-glow" aria-hidden="true"></div>
        <div className="cd-poster-kicker">
          {concert.festaEntitat || (concert.kind && concert.kind !== "bolo" ? KIND_LABELS[concert.kind] : "concert")}
        </div>
        <div className="cd-poster-title">{concert.bandName}</div>
        <div className="cd-poster-date">{capitalize(formatDateFull(concert.date))}{concert.time ? ` — ${concert.time}h` : ""}</div>
        {(concert.venue || concert.city) && (
          <div className="cd-poster-place">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            {[concert.venue, concert.city ? concert.city.split(",")[0] : ""].filter(Boolean).join(" · ")}
          </div>
        )}
        <div className="cd-poster-foot">
          <span className="badge" style={{ background: sc.bg, color: sc.color }}>{concert.status}</span>
          {isFuture && myName && (
            <AttendanceButtons concertId={concert.id} current={myAnswer} />
          )}
        </div>
      </div>

      <div className="stats-tabs cd-tabs">
        {([["info", "Informació"], ["ruta", "Full de ruta"], ["assistencia", "Assistència"], ["caixet", "El meu caixet"]] as const).map(([k, label]) => (
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

      {tab === "ruta" && (
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
                    <div className="member-name">{m.name}{m.name === myName ? " (tu)" : ""}</div>
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

      {tab === "caixet" && (
        <div className="panel cd-section">
          <div className="panel-title cd-section-title">El meu caixet</div>
          {!showFees ? (
            <div className="t-dim" style={{ fontSize: 13.5 }}>Aquest grup no mostra els caixets als membres.</div>
          ) : myAmount === null ? (
            <div className="t-dim" style={{ fontSize: 13.5 }}>
              El gestor encara no ha fet el repartiment d&apos;aquest bolo — quan el faci, veuràs aquí què et toca.
            </div>
          ) : (
            <div className="acd-payout">
              <div className="acd-payout-amount">{formatCurrency(myAmount)}</div>
              <div className="t-dim" style={{ fontSize: 12.5 }}>
                El que et toca del bolo del {formatDate(concert.date)}. Només lectura — el repartiment el fa el gestor.
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
