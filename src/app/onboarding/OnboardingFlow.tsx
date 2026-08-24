"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { INSTRUMENT_PRESETS, instrumentIconFor } from "@/lib/tags";
import { completeArtistOnboardingAction, completeManagerOnboardingAction } from "./actions";

type Step = "role" | "artist" | "manager" | "manager-done";

const DEFAULT_COLOR1 = "#8b7bff";
const DEFAULT_COLOR2 = "#e86bd0";

function RoleIcon({ paths }: { paths: string }) {
  return (
    <svg
      className="role-card-icon"
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: paths }}
    />
  );
}

export default function OnboardingFlow({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("role");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Artista
  const [artistName, setArtistName] = useState(defaultName);
  const [instruments, setInstruments] = useState<string[]>([]);
  const [instrumentInput, setInstrumentInput] = useState("");

  // Gestor
  const [managerName, setManagerName] = useState(defaultName);
  const [groupName, setGroupName] = useState("");
  const [logo, setLogo] = useState("");
  const [color1, setColor1] = useState(DEFAULT_COLOR1);
  const [color2, setColor2] = useState(DEFAULT_COLOR2);
  const [invites, setInvites] = useState<{ email: string; name: string }[]>([{ email: "", name: "" }]);
  const [joinCode, setJoinCode] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function addInstrument() {
    const value = instrumentInput.trim();
    if (!value) return;
    if (!instruments.some((i) => i.toLowerCase() === value.toLowerCase())) {
      setInstruments([...instruments, value]);
    }
    setInstrumentInput("");
  }

  function onLogoFile(file: File | undefined) {
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      // Redimensiona a 256px màx. perquè el dataURL que va a la BD sigui petit.
      const max = 256;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      setLogo(canvas.toDataURL("image/png"));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  async function submitArtist() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await completeArtistOnboardingAction({ name: artistName, instruments });
      if (!result.ok) { setError(result.error); return; }
      router.push("/artista");
      router.refresh();
    } catch {
      setError("No s'ha pogut completar l'alta. Torna-ho a provar.");
    } finally {
      setBusy(false);
    }
  }

  async function submitManager() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await completeManagerOnboardingAction({
        managerName,
        groupName,
        logo,
        color1,
        color2,
        invites: invites.filter((i) => i.email.trim()),
      });
      if (!result.ok) { setError(result.error); return; }
      setJoinCode(result.joinCode || "");
      setStep("manager-done");
    } catch {
      setError("No s'ha pogut crear el grup. Torna-ho a provar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="onboarding-card">
      {step === "role" && (
        <>
          <h1 className="onboarding-title">Benvingut/da a Escenari</h1>
          <p className="onboarding-sub">Abans de començar, digue&apos;ns quin és el teu paper.</p>
          <div className="role-cards">
            <button className="role-card" onClick={() => setStep("manager")}>
              <RoleIcon paths='<path d="M3 21h18"></path><path d="M5 21V7l7-4 7 4v14"></path><path d="M9 21v-6h6v6"></path>' />
              <div className="role-card-title">Soc gestor/a</div>
              <div className="role-card-desc">
                Porto un o més grups: calendari, concerts, facturació i logística. Crearàs el teu grup i convidaràs els músics.
              </div>
            </button>
            <button className="role-card" onClick={() => setStep("artist")}>
              <RoleIcon paths='<path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>' />
              <div className="role-card-title">Soc artista</div>
              <div className="role-card-desc">
                Toco en un o més grups. Veuràs els teus bolos, confirmaràs assistència i t&apos;uniràs als grups amb una invitació o un codi.
              </div>
            </button>
          </div>
        </>
      )}

      {step === "artist" && (
        <div className="onboarding-form">
          <button className="onboarding-back" onClick={() => setStep("role")}>← Torna enrere</button>
          <h1 className="onboarding-title">El teu perfil d&apos;artista</h1>
          <div className="field-group">
            <label className="field-label">El teu nom</label>
            <input
              className="field-input"
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              placeholder="Nom i cognoms"
              autoFocus
            />
          </div>
          <div className="field-group">
            <label className="field-label">Instruments que toques</label>
            {instruments.length > 0 && (
              <div className="chip-row" style={{ marginBottom: 4 }}>
                {instruments.map((inst) => {
                  const icon = instrumentIconFor(inst);
                  return (
                    <span className="instrument-chip" key={inst}>
                      {icon && <img src={icon} alt="" />}
                      {inst}
                      <button onClick={() => setInstruments(instruments.filter((i) => i !== inst))} aria-label={`Treu ${inst}`}>✕</button>
                    </span>
                  );
                })}
              </div>
            )}
            <div className="invite-row">
              <input
                className="field-input"
                list="instrument-presets"
                value={instrumentInput}
                onChange={(e) => setInstrumentInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addInstrument(); } }}
                placeholder="Guitarra, veu, bateria..."
              />
              <datalist id="instrument-presets">
                {INSTRUMENT_PRESETS.map((i) => <option key={i} value={i} />)}
              </datalist>
              <button className="btn-icon-ghost" onClick={addInstrument} type="button">+</button>
            </div>
          </div>
          <div className="onboarding-error">{error}</div>
          <button className="btn-primary" onClick={submitArtist} disabled={busy}>
            {busy ? "Un moment..." : "Continua"}
          </button>
        </div>
      )}

      {step === "manager" && (
        <div className="onboarding-form">
          <button className="onboarding-back" onClick={() => setStep("role")}>← Torna enrere</button>
          <h1 className="onboarding-title">Crea el teu grup</h1>
          <div className="field-group">
            <label className="field-label">El teu nom</label>
            <input className="field-input" value={managerName} onChange={(e) => setManagerName(e.target.value)} placeholder="Nom i cognoms" />
          </div>
          <div className="field-group">
            <label className="field-label">Nom del grup</label>
            <input className="field-input" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Ex.: La Bona Party" autoFocus />
          </div>
          <div className="field-group">
            <label className="field-label">Logotip</label>
            <div className="logo-upload-row">
              {logo ? (
                <img className="logo-preview" src={logo} alt="Logotip del grup" />
              ) : (
                <div className="logo-preview-empty">Sense<br />logo</div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => onLogoFile(e.target.files?.[0])}
              />
              <button className="btn-ghost-sm" style={{ width: "auto" }} type="button" onClick={() => fileRef.current?.click()}>
                {logo ? "Canvia el logotip" : "Puja un logotip"}
              </button>
              {logo && (
                <button className="btn-icon-ghost" type="button" onClick={() => setLogo("")} aria-label="Treu el logotip">✕</button>
              )}
            </div>
          </div>
          <div className="field-group">
            <label className="field-label">Colors del grup</label>
            <div className="color-row">
              <div className="color-field">
                <input type="color" value={color1} onChange={(e) => setColor1(e.target.value)} />
                <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Principal</span>
              </div>
              <div className="color-field">
                <input type="color" value={color2} onChange={(e) => setColor2(e.target.value)} />
                <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Secundari</span>
              </div>
            </div>
          </div>
          <div className="field-group">
            <label className="field-label">Convida els membres (correu electrònic)</label>
            {invites.map((invite, idx) => (
              <div className="invite-row" key={idx}>
                <input
                  className="field-input"
                  type="email"
                  value={invite.email}
                  onChange={(e) => setInvites(invites.map((v, i) => (i === idx ? { ...v, email: e.target.value } : v)))}
                  placeholder="musica@exemple.cat"
                />
                <input
                  className="field-input"
                  value={invite.name}
                  onChange={(e) => setInvites(invites.map((v, i) => (i === idx ? { ...v, name: e.target.value } : v)))}
                  placeholder="Nom (opcional)"
                />
                <button
                  className="btn-icon-ghost"
                  type="button"
                  onClick={() => setInvites(invites.filter((_, i) => i !== idx))}
                  aria-label="Treu la invitació"
                >
                  ✕
                </button>
              </div>
            ))}
            <button className="btn-ghost-sm" type="button" onClick={() => setInvites([...invites, { email: "", name: "" }])}>
              + Afegeix un altre membre
            </button>
          </div>
          <div className="onboarding-error">{error}</div>
          <button className="btn-primary" onClick={submitManager} disabled={busy}>
            {busy ? "Creant el grup..." : "Crea el grup"}
          </button>
        </div>
      )}

      {step === "manager-done" && (
        <div className="onboarding-form">
          <h1 className="onboarding-title">Grup creat! 🎉</h1>
          <p className="onboarding-sub">
            Els membres que has convidat veuran la invitació quan entrin a Escenari amb el seu correu.
            També poden unir-se al grup amb aquest codi:
          </p>
          <div className="join-code-box">
            <div className="join-code-value">{joinCode || "—"}</div>
            <div className="join-code-label">Codi d&apos;invitació del grup</div>
          </div>
          <button
            className="btn-primary"
            onClick={() => {
              router.push("/resum");
              router.refresh();
            }}
          >
            Entra a Escenari
          </button>
        </div>
      )}
    </div>
  );
}
