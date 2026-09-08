"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { Band } from "@/lib/types";
import { saveConcertAction, createEventAction } from "@/app/(app)/concerts/actions";
import { personPhotoDataUri, bandPhotoDataUri } from "@/lib/tags";
import { normalize } from "@/lib/text";
import { listLinkedMemberNamesAction } from "@/app/(app)/grup/actions";
import VerifiedTick from "@/components/VerifiedTick";
import InlineDatePicker from "@/components/InlineDatePicker";
import TimePeriodBubble from "@/components/TimePeriodBubble";
import VenueSearchField from "@/components/VenueSearchField";

const KINDS: { kind: "bolo" | "assaig" | "reunio" | "altre"; label: string; icon: string; desc: string }[] = [
  { kind: "bolo", label: "Bolo", icon: "🎤", desc: "Concert amb tota la fitxa: caixet, full de ruta, factura…" },
  { kind: "assaig", label: "Assaig", icon: "🥁", desc: "Assaig del grup, amb qui hi és convidat" },
  { kind: "reunio", label: "Reunió", icon: "🗓", desc: "Reunió de grup o de feina" },
  { kind: "altre", label: "Altre", icon: "✨", desc: "Qualsevol altre esdeveniment" },
];

// "+ Nou esdeveniment": primer es tria el tipus. Un bolo obre la fitxa
// completa; assaig/reunió/altre es creen en un moment des d'un popup amb
// data, convidats i repetició estil Google Calendar.
export default function NewEventButton({ bands, selectedBandId = "", allowBolo = true, defaultDate }: {
  bands: Band[];
  selectedBandId?: string;
  allowBolo?: boolean; // els músics amb permís creen assajos/reunions, no bolos
  defaultDate?: string;
}) {
  const router = useRouter();
  const todayStr = new Date().toISOString().slice(0, 10);
  const [step, setStep] = useState<"closed" | "kind" | "quick" | "bolo-band">("closed");
  const [kind, setKind] = useState<"assaig" | "reunio" | "altre">("assaig");
  const [bandId, setBandId] = useState(selectedBandId || bands[0]?.id || "");
  const [title, setTitle] = useState("");
  // Aquest botó viu muntat tota l'estona (no es refà en canviar de dia al
  // calendari), així que l'inicial de "defaultDate" només serveix per al
  // primer cop — es torna a agafar el dia sel·leccionat cada vegada que
  // s'obre el flux (vegeu el onClick del botó "+ Nou esdeveniment").
  const [date, setDate] = useState(defaultDate || todayStr);
  const [time, setTime] = useState("20:00");
  const [exactTime, setExactTime] = useState("");
  const [city, setCity] = useState("");
  const [venue, setVenue] = useState("");
  const [address, setAddress] = useState("");
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [freq, setFreq] = useState<"cap" | "setmanal" | "quinzenal" | "mensual">("cap");
  const [count, setCount] = useState(4);
  const [busy, setBusy] = useState(false);
  // Els popups es pengen de <body> via portal: el botó viu dins la barra de
  // filtres (que té backdrop-filter), i un overlay "fixed" a dins seu
  // quedava atrapat i sortia per sota de la pàgina.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const portal = (node: React.ReactNode) => (mounted ? createPortal(node, document.body) : null);

  const band = bands.find((b) => b.id === bandId) || null;
  // Qui té compte d'Escenari vinculat (tick lila als convidats) — només es
  // consulta quan el popup és obert.
  const [linkedNames, setLinkedNames] = useState<string[]>([]);
  useEffect(() => {
    if (step === "closed" || !bandId) return;
    let alive = true;
    listLinkedMemberNamesAction(bandId).then((n) => { if (alive) setLinkedNames(n); }).catch(() => {});
    return () => { alive = false; };
  }, [bandId, step]);
  const linkedSet = new Set(linkedNames.map(normalize));

  // Crea el bolo amb el grup triat a "bandId" — es fa servir tant si es crea
  // de seguida (grup ja decidit) com des del pas d'escollir grup.
  async function createBolo() {
    setBusy(true);
    const created = await saveConcertAction({
      id: null, bandName: band?.name || "", date: date || defaultDate || todayStr,
      time: "", venue: "", city: "", festaEntitat: "", amount: 0, status: "pendent",
      attendance: {}, substitutes: {}, noSubstitute: {}, skipDefaults: true,
    });
    setBusy(false);
    setStep("closed");
    if (created) router.push(`/concerts/${created.id}`);
  }

  async function chooseKind(k: "bolo" | "assaig" | "reunio" | "altre") {
    if (k === "bolo") {
      // Amb més d'un grup i cap de preseleccionat, primer cal triar a
      // quin — abans es creava sempre al grup que ja estava actiu, sense
      // poder-ho canviar.
      if (!selectedBandId && bands.length > 1) { setStep("bolo-band"); return; }
      await createBolo();
      return;
    }
    setKind(k);
    setInvited(new Set((band?.members || []).map((m) => m.name))); // per defecte, tothom
    setStep("quick");
  }

  async function handleCreate() {
    if (!bandId) return;
    setBusy(true);
    const { created } = await createEventAction({
      bandId, kind, title, date, time, exactTime, city, venue, address,
      invited: Array.from(invited),
      repeat: { freq, count },
    });
    setBusy(false);
    setStep("closed");
    setTitle("");
    router.refresh();
    if (created > 1) alert(`${created} esdeveniments creats.`);
  }

  return (
    <>
      <button className="glow-cta" onClick={() => { setDate(defaultDate || todayStr); setStep("kind"); }}>+ Nou esdeveniment</button>

      {step === "kind" && portal(
        <div className="modal-overlay" onClick={() => setStep("closed")}>
          <div className="modal narrow" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">Quin tipus d&apos;esdeveniment?</div>
              <button className="cf-head-close" onClick={() => setStep("closed")}>✕</button>
            </div>
            <div className="ne-kinds">
              {KINDS.filter((k) => allowBolo || k.kind !== "bolo").map((k) => (
                <button key={k.kind} type="button" className="ne-kind" disabled={busy} onClick={() => chooseKind(k.kind)}>
                  <span className="ne-kind-icon">{k.icon}</span>
                  <span className="ne-kind-main">
                    <span className="ne-kind-label">{k.label}</span>
                    <span className="ne-kind-desc">{k.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === "bolo-band" && portal(
        <div className="modal-overlay" onClick={() => setStep("closed")}>
          <div className="modal narrow" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">Quin grup?</div>
              <button className="cf-head-close" onClick={() => setStep("closed")}>✕</button>
            </div>
            <div className="modal-form" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="form-label">Grup</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                  {bands.map((b) => (
                    <button key={b.id} type="button" className={"band-chip" + (bandId === b.id ? " active" : "")} onClick={() => setBandId(b.id)}>
                      <img src={b.logo || bandPhotoDataUri(b)} alt="" />
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="form-label">Data</label>
                <InlineDatePicker value={date} onChange={setDate} today={todayStr} />
              </div>
              <div className="modal-actions">
                <div className="spacer"></div>
                <button className="btn-outline" onClick={() => setStep("kind")}>← Enrere</button>
                <button className="btn-save" disabled={busy || !bandId} onClick={createBolo}>{busy ? "Creant…" : "Crea"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === "quick" && portal(
        <div className="modal-overlay" onClick={() => setStep("closed")}>
          <div className="modal narrow" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">Nou {KINDS.find((k) => k.kind === kind)?.label.toLowerCase()}</div>
              <button className="cf-head-close" onClick={() => setStep("closed")}>✕</button>
            </div>
            <div className="modal-form" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {!selectedBandId && bands.length > 1 && (
                <div>
                  <label className="form-label">Grup</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                    {bands.map((b) => (
                      <button key={b.id} type="button" className={"band-chip" + (bandId === b.id ? " active" : "")}
                        onClick={() => { setBandId(b.id); setInvited(new Set((b.members || []).map((m) => m.name))); }}>
                        <img src={b.logo || bandPhotoDataUri(b)} alt="" />
                        {b.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="form-label">Títol (opcional)</label>
                <input className="field-input form-field" placeholder={kind === "assaig" ? "Assaig general" : "Motiu"} value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label className="form-label">Data</label>
                  <InlineDatePicker value={date} onChange={setDate} today={todayStr} /></div>
                <div className="cd-time-pair-row">
                  <div className="cd-time-pair-col" style={{ flex: 1.2 }}>
                    <label className="form-label">Hora aproximada</label>
                    <div className="cd-time-pair-col-body">
                      <TimePeriodBubble time={time} onChange={setTime} />
                    </div>
                  </div>
                  <div className="cd-time-pair-col grow">
                    <label className="form-label">Hora exacta</label>
                    <div className="cd-time-pair-col-body">
                      <input type="time" className="field-input form-field" value={exactTime} onChange={(e) => setExactTime(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="form-label">Recinte</label>
                  <VenueSearchField
                    venue={venue}
                    onCommit={(v) => { setVenue(v.venue); if (v.city) setCity(v.city); if (v.address) setAddress(v.address); }}
                  />
                </div>
                <div><label className="form-label">Adreça</label>
                  <input className="field-input form-field" placeholder="S'empleix en triar un recinte…" value={address} onChange={(e) => setAddress(e.target.value)} /></div>
              </div>

              {/* Convidats */}
              <div>
                <label className="form-label">Qui hi convides</label>
                <div className="ne-invite-grid">
                  {(band?.members || []).map((m) => {
                    const on = invited.has(m.name);
                    return (
                      <button key={m.name} type="button" className={"ne-invitee" + (on ? " on" : "")}
                        onClick={() => setInvited((prev) => { const n = new Set(prev); if (on) n.delete(m.name); else n.add(m.name); return n; })}>
                        <img src={personPhotoDataUri(m.name)} alt="" />
                        <span>{m.name.split(" ")[0]}{linkedSet.has(normalize(m.name)) && <VerifiedTick size={11} />}</span>
                        <i>{on ? "✓" : ""}</i>
                      </button>
                    );
                  })}
                  {(band?.members || []).length === 0 && <span className="t-dim" style={{ fontSize: 12 }}>Aquest grup no té membres.</span>}
                </div>
              </div>

              {/* Repetició */}
              <div style={{ display: "grid", gridTemplateColumns: freq === "cap" ? "1fr" : "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="form-label">Es repeteix</label>
                  <select className="field-input form-field" value={freq} onChange={(e) => setFreq(e.target.value as typeof freq)}>
                    <option value="cap">No es repeteix</option>
                    <option value="setmanal">Cada setmana</option>
                    <option value="quinzenal">Cada dues setmanes</option>
                    <option value="mensual">Cada mes</option>
                  </select>
                </div>
                {freq !== "cap" && (
                  <div>
                    <label className="form-label">Quantes vegades</label>
                    <select className="field-input form-field" value={count} onChange={(e) => setCount(parseInt(e.target.value, 10))}>
                      {[2, 3, 4, 6, 8, 10, 12, 20, 26].map((n) => <option key={n} value={n}>×{n}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <div className="spacer"></div>
                <button className="btn-outline" onClick={() => setStep("kind")}>← Enrere</button>
                <button className="btn-save" disabled={busy || !bandId} onClick={handleCreate}>{busy ? "Creant…" : "Crea"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
