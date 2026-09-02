"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import InstrumentPicker from "@/components/InstrumentPicker";
import { completeArtistOnboardingAction, completeAgencyOnboardingAction } from "./actions";

type Step = "role" | "artist" | "agency" | "agency-done";

type Invite = { name: string; role: string; email: string };

function RoleIcon({ paths }: { paths: string }) {
  return (
    <span className="role-card-icon-wrap">
      <svg
        className="role-card-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: paths }}
      />
    </span>
  );
}

// Llegeix una imatge i la redimensiona (256px màx.) perquè el dataURL que
// va a la BD sigui petit.
function readImage(file: File | undefined, set: (dataUrl: string) => void, max = 256) {
  if (!file) return;
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    set(canvas.toDataURL("image/png"));
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" className="btn-outline" style={{ padding: "7px 11px", fontSize: 12 }}
      onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }}>
      {copied ? "Copiat ✓" : "Copia l'enllaç"}
    </button>
  );
}

export default function OnboardingFlow({ defaultName, next }: { defaultName: string; next?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("role");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Artista
  const [artistName, setArtistName] = useState(defaultName);
  const [instruments, setInstruments] = useState<string[]>([]);

  // Agència
  const [agencyName, setAgencyName] = useState("");
  const [agencyLogo, setAgencyLogo] = useState("");
  const [managerName, setManagerName] = useState(defaultName);
  const [managerPhoto, setManagerPhoto] = useState("");
  const [managerRole, setManagerRole] = useState("Mànager");
  const [invites, setInvites] = useState<Invite[]>([{ name: "", role: "", email: "" }]);
  const [inviteLinks, setInviteLinks] = useState<{ name: string; email: string; url: string }[]>([]);
  const agencyLogoRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  async function submitArtist() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await completeArtistOnboardingAction({ name: artistName, instruments });
      if (!result.ok) { setError(result.error); return; }
      // Si venia d'un enllaç d'invitació a un grup, hi torna per reclamar-lo.
      router.push(next && next.startsWith("/") ? next : "/artista");
      router.refresh();
    } catch {
      setError("No s'ha pogut completar l'alta. Torna-ho a provar.");
    } finally {
      setBusy(false);
    }
  }

  async function submitAgency() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await completeAgencyOnboardingAction({
        agencyName, agencyLogo, managerName, managerPhoto, managerRole,
        invites: invites.filter((i) => i.name.trim() || i.email.trim()),
      });
      if (!result.ok) { setError(result.error); return; }
      setInviteLinks(result.invites);
      setStep("agency-done");
    } catch {
      setError("No s'ha pogut crear l'agència. Torna-ho a provar.");
    } finally {
      setBusy(false);
    }
  }

  const wide = step === "role" || step === "agency" || step === "agency-done";

  return (
    <div className={"onboarding-card" + (wide ? " wide" : "")}>
      {step === "role" && (
        <>
          <h1 className="onboarding-title center">Com faràs servir Escenari?</h1>
          <div className="role-cards">
            <button className="role-card" onClick={() => setStep("agency")}>
              <RoleIcon paths='<path d="M3 21h18"></path><path d="M5 21V7l7-4 7 4v14"></path><path d="M9 21v-6h6v6"></path><path d="M9 10h.01"></path><path d="M15 10h.01"></path><path d="M9 13h.01"></path><path d="M15 13h.01"></path>' />
              <div className="role-card-title">Soc una agència</div>
            </button>
            <button className="role-card" onClick={() => setStep("artist")}>
              <RoleIcon paths='<path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>' />
              <div className="role-card-title">Soc artista</div>
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
            <InstrumentPicker value={instruments} onChange={setInstruments} />
          </div>
          <div className="onboarding-error">{error}</div>
          <button className="btn-primary" onClick={submitArtist} disabled={busy}>
            {busy ? "Un moment..." : "Continua"}
          </button>
        </div>
      )}

      {step === "agency" && (
        <div className="onboarding-form">
          <button className="onboarding-back" onClick={() => setStep("role")}>← Torna enrere</button>
          <h1 className="onboarding-title">La teva agència</h1>

          {/* L'agència: és qui té tots els grups a dins i surt a dalt de la
              barra de grups amb el seu logotip. */}
          <div className="ob-section">
            <div className="ob-section-title">Agència</div>
            <div className="ob-row-logo">
              <button type="button" className="ob-logo-btn" onClick={() => agencyLogoRef.current?.click()} title="Logotip de l'agència">
                {agencyLogo ? <img src={agencyLogo} alt="" /> : <span>Logo</span>}
              </button>
              <input ref={agencyLogoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => readImage(e.target.files?.[0], setAgencyLogo)} />
              <div className="field-group" style={{ flex: 1 }}>
                <label className="field-label">Nom de l&apos;agència</label>
                <input className="field-input" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} placeholder="Ex.: Bona Nit Produccions" autoFocus />
              </div>
            </div>
          </div>

          {/* Qui ets tu dins l'agència. */}
          <div className="ob-section">
            <div className="ob-section-title">Tu</div>
            <div className="ob-row-logo">
              <button type="button" className="ob-logo-btn round" onClick={() => photoRef.current?.click()} title="La teva foto">
                {managerPhoto ? <img src={managerPhoto} alt="" /> : <span>Foto</span>}
              </button>
              <input ref={photoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => readImage(e.target.files?.[0], setManagerPhoto, 512)} />
              <div className="ob-two">
                <div className="field-group">
                  <label className="field-label">El teu nom</label>
                  <input className="field-input" value={managerName} onChange={(e) => setManagerName(e.target.value)} placeholder="Nom i cognoms" />
                </div>
                <div className="field-group">
                  <label className="field-label">El teu càrrec</label>
                  <input className="field-input" value={managerRole} onChange={(e) => setManagerRole(e.target.value)} placeholder="Mànager, booking, producció…" />
                </div>
              </div>
            </div>
          </div>

          {/* La resta de l'equip: cadascú rep un enllaç que el deixa dins
              l'agència directament. */}
          <div className="ob-section">
            <div className="ob-section-title">Convida el teu equip <span className="t-dim" style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(opcional)</span></div>
            {invites.map((inv, idx) => (
              <div className="invite-row invite-row-3" key={idx}>
                <input className="field-input" value={inv.name} placeholder="Nom"
                  onChange={(e) => setInvites(invites.map((v, i) => (i === idx ? { ...v, name: e.target.value } : v)))} />
                <input className="field-input" value={inv.role} placeholder="Càrrec"
                  onChange={(e) => setInvites(invites.map((v, i) => (i === idx ? { ...v, role: e.target.value } : v)))} />
                <input className="field-input" type="email" value={inv.email} placeholder="Correu (opcional)"
                  onChange={(e) => setInvites(invites.map((v, i) => (i === idx ? { ...v, email: e.target.value } : v)))} />
                <button className="btn-icon-ghost" type="button" onClick={() => setInvites(invites.filter((_, i) => i !== idx))} aria-label="Treu la invitació">✕</button>
              </div>
            ))}
            <button className="btn-ghost-sm" type="button" onClick={() => setInvites([...invites, { name: "", role: "", email: "" }])}>
              + Afegeix una persona
            </button>
          </div>

          <div className="onboarding-error">{error}</div>
          <button className="btn-primary" onClick={submitAgency} disabled={busy}>
            {busy ? "Creant l'agència..." : "Crea l'agència"}
          </button>
        </div>
      )}

      {step === "agency-done" && (
        <div className="onboarding-form">
          <h1 className="onboarding-title">Agència creada 🎉</h1>
          {inviteLinks.length > 0 ? (
            <>
              <p className="onboarding-sub">
                Passa aquests enllaços a cada persona: en entrar-hi quedaran dins de l&apos;agència directament (als que tenen correu també els l&apos;hem enviat, si el correu està configurat).
              </p>
              <div className="ob-links">
                {inviteLinks.map((l) => (
                  <div key={l.url} className="ob-link-row">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="t-strong" style={{ fontSize: 13.5 }}>{l.name || l.email}</div>
                      <div className="t-dim" style={{ fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.url}</div>
                    </div>
                    <CopyButton text={l.url} />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="onboarding-sub">Ara crea el primer grup i convida&apos;n els músics des de Configuració.</p>
          )}
          <button
            className="btn-primary"
            onClick={() => {
              router.push("/configuracio");
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
