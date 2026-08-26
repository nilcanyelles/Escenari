"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Band, Concert } from "@/lib/types";
import { saveConcertAction, createEventAction } from "@/app/(app)/concerts/actions";
import { personPhotoDataUri } from "@/lib/tags";
import { normalize } from "@/lib/text";

const KINDS: { kind: "bolo" | "assaig" | "reunio" | "altre"; label: string; icon: string; desc: string }[] = [
  { kind: "bolo", label: "Bolo", icon: "🎤", desc: "Concert amb tota la fitxa: caixet, full de ruta, factura…" },
  { kind: "assaig", label: "Assaig", icon: "🥁", desc: "Assaig del grup, amb qui hi és convidat" },
  { kind: "reunio", label: "Reunió", icon: "🗓", desc: "Reunió de grup o de feina" },
  { kind: "altre", label: "Altre", icon: "✨", desc: "Qualsevol altre esdeveniment" },
];

// "+ Nou esdeveniment": primer es tria el tipus. Un bolo obre la fitxa
// completa; assaig/reunió/altre es creen en un moment des d'un popup amb
// data, convidats i repetició estil Google Calendar.
export default function NewEventButton({ bands, concerts = [], selectedBandId = "", allowBolo = true, defaultDate }: {
  bands: Band[];
  concerts?: Concert[];
  selectedBandId?: string;
  allowBolo?: boolean; // els músics amb permís creen assajos/reunions, no bolos
  defaultDate?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"closed" | "kind" | "quick">("closed");
  const [kind, setKind] = useState<"assaig" | "reunio" | "altre">("assaig");
  const [bandId, setBandId] = useState(selectedBandId || bands[0]?.id || "");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate || new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("20:00");
  const [city, setCity] = useState("");
  const [venue, setVenue] = useState("");
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [freq, setFreq] = useState<"cap" | "setmanal" | "quinzenal" | "mensual">("cap");
  const [count, setCount] = useState(4);
  const [busy, setBusy] = useState(false);

  const band = bands.find((b) => b.id === bandId) || null;

  // Ubicacions ja usades pel grup (local d'assaig, sales…): es proposen en
  // crear el següent esdeveniment.
  const pastVenues = useMemo(() => {
    const seen = new Map<string, { venue: string; city: string }>();
    concerts
      .filter((c) => c.bandId === bandId && c.venue.trim())
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach((c) => {
        const key = normalize(c.venue);
        if (!seen.has(key)) seen.set(key, { venue: c.venue, city: c.city });
      });
    return Array.from(seen.values()).slice(0, 30);
  }, [concerts, bandId]);

  async function chooseKind(k: "bolo" | "assaig" | "reunio" | "altre") {
    if (k === "bolo") {
      setBusy(true);
      const created = await saveConcertAction({
        id: null, bandName: band?.name || "", date: defaultDate || new Date().toISOString().slice(0, 10),
        time: "", venue: "", city: "", festaEntitat: "", amount: 0, status: "pendent",
        attendance: {}, substitutes: {}, noSubstitute: {}, skipDefaults: true,
      });
      setBusy(false);
      setStep("closed");
      if (created) router.push(`/concerts/${created.id}`);
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
      bandId, kind, title, date, time, city, venue,
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
      <button className="glow-cta" onClick={() => setStep("kind")}>+ Nou esdeveniment</button>

      {step === "kind" && (
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

      {step === "quick" && (
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
                  <select className="field-input form-field" value={bandId}
                    onChange={(e) => { setBandId(e.target.value); const b = bands.find((x) => x.id === e.target.value); setInvited(new Set((b?.members || []).map((m) => m.name))); }}>
                    {bands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="form-label">Títol (opcional)</label>
                <input className="field-input form-field" placeholder={kind === "assaig" ? "Assaig general" : "Motiu"} value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label className="form-label">Data</label>
                  <input className="field-input form-field" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
                <div><label className="form-label">Hora</label>
                  <input className="field-input form-field" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="form-label">Ubicació</label>
                  <input
                    className="field-input form-field" list="ne-venues" placeholder="Local d'assaig, sala…"
                    value={venue}
                    onChange={(e) => {
                      const v = e.target.value;
                      setVenue(v);
                      // En triar una ubicació coneguda, la població s'omple sola.
                      const known = pastVenues.find((p) => normalize(p.venue) === normalize(v));
                      if (known && known.city) setCity(known.city);
                    }}
                  />
                  <datalist id="ne-venues">
                    {pastVenues.map((p) => <option key={p.venue} value={p.venue}>{p.city ? p.city.split(",")[0] : ""}</option>)}
                  </datalist>
                </div>
                <div><label className="form-label">Població</label>
                  <input className="field-input form-field" placeholder={band?.city || "Població"} value={city} onChange={(e) => setCity(e.target.value)} /></div>
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
                        <span>{m.name.split(" ")[0]}</span>
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
