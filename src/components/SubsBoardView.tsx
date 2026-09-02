"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SubCandidate } from "@/lib/subs";
import { personPhotoDataUri, instrumentIconFor } from "@/lib/tags";
import { normalize } from "@/lib/text";
import { formatDate } from "@/lib/format";
import { addTrustedBackupAction } from "@/app/(app)/grup/actions";
import PlanLock from "@/components/PlanLock";
import type { BillingInfo } from "@/lib/plans";

type BandOpt = { id: string; name: string; backups: string[] };

// Borsa de suplents per al gestor: filtre per instrument i cerca, targeta
// per músic amb el que ha volgut compartir, i alta com a suplent de
// confiança del grup que es triï.
export default function SubsBoardView({ candidates, bands, today, billing, canUpgrade = true }: { candidates: SubCandidate[]; bands: BandOpt[]; today: string; billing?: BillingInfo; canUpgrade?: boolean }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [instrument, setInstrument] = useState("");
  const [targetBand, setTargetBand] = useState(bands[0]?.id || "");
  const [busy, setBusy] = useState<string | null>(null);
  const [added, setAdded] = useState<Record<string, string>>({}); // profileId -> band name

  const instruments = useMemo(() => {
    const seen = new Map<string, string>();
    candidates.forEach((c) => c.instruments.forEach((i) => { const k = normalize(i); if (!seen.has(k)) seen.set(k, i); }));
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  }, [candidates]);

  const q = normalize(search.trim());
  const list = candidates.filter((c) => {
    if (instrument && !c.instruments.some((i) => normalize(i) === normalize(instrument))) return false;
    if (q && !normalize(c.name).includes(q) && !c.instruments.some((i) => normalize(i).includes(q)) && !c.bands.some((b) => normalize(b).includes(q))) return false;
    return true;
  });
  const band = bands.find((b) => b.id === targetBand) || null;

  async function add(c: SubCandidate) {
    if (!band) return;
    setBusy(c.profileId);
    await addTrustedBackupAction(band.id, { name: c.name, instruments: c.instruments, phone: c.phone, email: c.email });
    setAdded((prev) => ({ ...prev, [c.profileId]: band.name }));
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="glow" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="glow-blooms" aria-hidden="true"></div>
      <div>
        <div className="sx-title" style={{ fontSize: 22 }}>Suplències</div>
        <div className="t-dim" style={{ fontSize: 13, marginTop: 4 }}>
          Músics d&apos;Escenari que s&apos;han declarat disponibles per fer suplències. Afegeix-los als suplents de confiança d&apos;un grup per poder-los triar quan algú no pugui anar a un bolo.
        </div>
      </div>

      {billing && !billing.caps.subsBoard ? (
        <PlanLock billing={billing} feature="subsBoard" canUpgrade={canUpgrade} title="Borsa de suplents d'Escenari" description="Músics disponibles per a suplències, amb instruments, disponibilitat i contacte, per afegir-los als suplents de confiança dels teus grups. Inclòs als plans d'Agència." />
      ) : (<>
      <div className="filter-bar subs-filterbar">
        <input className="input search" type="text" placeholder="Cerca per nom, instrument o grup…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" value={instrument} onChange={(e) => setInstrument(e.target.value)}>
          <option value="">Tots els instruments</option>
          {instruments.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
        {bands.length > 1 && (
          <select className="input" value={targetBand} onChange={(e) => setTargetBand(e.target.value)} title="Grup on afegir els suplents">
            {bands.map((b) => <option key={b.id} value={b.id}>Afegir a: {b.name}</option>)}
          </select>
        )}
      </div>

      {list.length === 0 ? (
        <div className="panel t-dim" style={{ fontSize: 13 }}>
          {candidates.length === 0 ? "Encara cap músic s'ha declarat disponible per a suplències." : "Cap músic coincideix amb el filtre."}
        </div>
      ) : (
        <div className="subs-grid">
          {list.map((c) => {
            const already = band ? band.backups.some((n) => normalize(n) === normalize(c.name)) || added[c.profileId] === band.name : false;
            const nextDays = c.availableDays.filter((d) => d >= today).slice(0, 4);
            return (
              <div key={c.profileId} className="subs-card">
                <div className="subs-card-head">
                  <img className="subs-photo" src={c.photoFileId ? `/api/file/${c.photoFileId}` : personPhotoDataUri(c.name)} alt="" />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="member-name">{c.name}</div>
                    <div className="member-instruments">
                      {c.instruments.slice(0, 4).map((ins) => {
                        const icon = instrumentIconFor(ins);
                        return <span key={ins} className="member-instrument-chip">{icon && <img src={icon} alt="" />}{ins}</span>;
                      })}
                      {c.instruments.length === 0 && <span className="t-dim" style={{ fontSize: 11.5 }}>Sense instruments indicats</span>}
                    </div>
                  </div>
                </div>
                {c.bands.length > 0 && <div className="t-dim" style={{ fontSize: 12 }}>Toca amb: {c.bands.join(", ")}</div>}
                {c.bio && <div className="subs-bio">{c.bio}</div>}
                <div className="subs-avail">
                  {nextDays.length
                    ? <>Disponible: {nextDays.map((d) => formatDate(d)).join(", ")}{c.availableDays.length > nextDays.length ? "…" : ""}</>
                    : <span className="t-dim">Encara no ha marcat dies al calendari.</span>}
                </div>
                <div className="subs-contact">
                  {c.contactVisible ? (
                    <>
                      {c.phone && <a className="btn-outline" href={`tel:${c.phone.replace(/\s/g, "")}`}>Truca</a>}
                      {c.phone && <a className="btn-outline cd-wa-btn" href={`https://wa.me/${c.phone.replace(/[^\d]/g, "")}`} target="_blank" rel="noreferrer">WhatsApp</a>}
                      {c.email && <a className="btn-outline" href={`mailto:${c.email}`}>Correu</a>}
                      {!c.phone && !c.email && <span className="t-dim" style={{ fontSize: 12 }}>Sense dades de contacte al perfil.</span>}
                    </>
                  ) : (
                    <span className="t-dim" style={{ fontSize: 12 }}>No mostra el contacte — contacta-hi des del seu perfil.</span>
                  )}
                </div>
                <div className="subs-actions">
                  <a className="btn-outline" href={`/p/${c.profileId}`} target="_blank" rel="noreferrer">Veure perfil</a>
                  <button type="button" className="btn-save" disabled={!band || already || busy === c.profileId} onClick={() => add(c)}>
                    {already ? `✓ Suplent de ${band?.name}` : busy === c.profileId ? "Afegint…" : `Afegeix a ${band?.name || "un grup"}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>)}
    </div>
  );
}
