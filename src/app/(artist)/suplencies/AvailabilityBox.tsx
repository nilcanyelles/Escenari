"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setSubsAvailabilityAction, setSubsPrefsAction } from "../actions";
import InstrumentPicker from "@/components/InstrumentPicker";

export type SubsPrefs = { maxKm: number; homeCity: string; anyInstrument: boolean; instruments: string[] };
const KM_OPTIONS = [0, 25, 50, 100, 150, 250];

// El músic marca si vol que el tinguin en compte per a suplències, si el seu
// perfil és visible per als gestors que en busquen, fins a quina distància
// (i des d'on) se'l pot contactar, i per a quins instruments.
export default function AvailabilityBox({ open, visible, prefs: initialPrefs, profileInstruments }: {
  open: boolean;
  visible: boolean;
  prefs: SubsPrefs;
  profileInstruments: string[];
}) {
  const router = useRouter();
  const [state, setState] = useState({ open, visible });
  const [prefs, setPrefs] = useState<SubsPrefs>(initialPrefs);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savedPrefs, setSavedPrefs] = useState(false);

  async function toggle(key: "open" | "visible") {
    const next = { ...state, [key]: !state[key] };
    setState(next);
    await setSubsAvailabilityAction(key === "open" ? { open: next.open } : { visible: next.visible });
    router.refresh();
  }

  async function savePrefs() {
    setSavingPrefs(true);
    await setSubsPrefsAction(prefs);
    setSavingPrefs(false);
    setSavedPrefs(true);
    window.setTimeout(() => setSavedPrefs(false), 1800);
    router.refresh();
  }

  return (
    <div className="panel" style={{ marginBottom: 18 }}>
      <div className="panel-title" style={{ marginBottom: 10 }}>La teva disponibilitat</div>
      <div className="avail-rows">
        <button type="button" className={"avail-row" + (state.open ? " on" : "")} onClick={() => toggle("open")}>
          <span className="avail-check">{state.open ? "✓" : ""}</span>
          <span className="avail-main">
            <span className="avail-label">Disponible per a suplències</span>
            <span className="avail-desc">Els grups poden comptar amb tu quan els falti algú del teu instrument.</span>
          </span>
        </button>
        <button type="button" className={"avail-row" + (state.visible ? " on" : "")} onClick={() => toggle("visible")}>
          <span className="avail-check">{state.visible ? "✓" : ""}</span>
          <span className="avail-main">
            <span className="avail-label">Perfil visible</span>
            <span className="avail-desc">El teu perfil (foto, instruments, experiència) es pot veure des de l&apos;enllaç compartible.</span>
          </span>
        </button>
      </div>

      <div className="subs-prefs">
        <div className="subs-prefs-block">
          <div className="cd-subtitle">Fins on et poden contactar</div>
          <div className="subs-prefs-row">
            <label className="subs-prefs-field">
              <span className="form-label">Distància màxima</span>
              <select className="field-input compact-field" value={prefs.maxKm} onChange={(e) => setPrefs({ ...prefs, maxKm: parseInt(e.target.value, 10) || 0 })}>
                {KM_OPTIONS.map((k) => <option key={k} value={k}>{k === 0 ? "Qualsevol distància" : `Fins a ${k} km`}</option>)}
              </select>
            </label>
            <label className="subs-prefs-field">
              <span className="form-label">Des d&apos;on (la teva població)</span>
              <input
                className="field-input compact-field" type="text" placeholder="Girona, Manresa…"
                value={prefs.homeCity} disabled={prefs.maxKm === 0}
                onChange={(e) => setPrefs({ ...prefs, homeCity: e.target.value })}
              />
            </label>
          </div>
          <div className="avail-desc">Només veuràs (i només et proposaran per a) bolos dins d&apos;aquesta distància. Sense població no es pot mesurar: aleshores no es filtra.</div>
        </div>

        <div className="subs-prefs-block">
          <div className="cd-subtitle">Per a quins instruments</div>
          <div className="cd-att-controls" style={{ marginTop: 0 }}>
            <button type="button" className={"cd-att-btn neutral" + (prefs.anyInstrument ? " active" : "")} onClick={() => setPrefs({ ...prefs, anyInstrument: true })}>Qualsevol</button>
            <button
              type="button" className={"cd-att-btn neutral" + (!prefs.anyInstrument ? " active" : "")}
              onClick={() => setPrefs({ ...prefs, anyInstrument: false, instruments: prefs.instruments.length ? prefs.instruments : profileInstruments })}
            >Només els que triï</button>
          </div>
          {!prefs.anyInstrument && (
            <div style={{ marginTop: 10 }}>
              <InstrumentPicker value={prefs.instruments} onChange={(ins) => setPrefs({ ...prefs, instruments: ins })} />
            </div>
          )}
        </div>

        <div className="subs-prefs-actions">
          <button type="button" className="btn-save" disabled={savingPrefs} onClick={savePrefs}>{savingPrefs ? "Desant…" : "Desa les preferències"}</button>
          {savedPrefs && <span className="t-dim" style={{ fontSize: 12.5 }}>Desat ✓</span>}
          <span className="t-dim" style={{ fontSize: 12.5 }}>
            La disponibilitat dia a dia es marca al teu <Link href="/artista/agenda" className="quick-link">Calendari</Link>.
          </span>
        </div>
      </div>
    </div>
  );
}
