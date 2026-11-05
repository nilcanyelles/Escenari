"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import UsernameField from "@/components/UsernameField";
import { updateUsernameAction } from "@/app/p/profile-actions";

export default function ChooseUsernameForm({ name, role }: { name: string; role: "manager" | "artist" }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    const res = await updateUsernameAction(username);
    if (!res.ok) { setError(res.error || "No s'ha pogut desar."); setBusy(false); return; }
    router.push(role === "artist" ? "/artista" : "/resum");
    router.refresh();
  }

  return (
    <div className="onboarding-card">
      <div className="onboarding-form">
        <h1 className="onboarding-title">Nova actualització a Escenari</h1>
        <p className="onboarding-sub">
          Hola, {name.split(" ")[0]}. Escull el teu perfil d&apos;usuari per continuar.
        </p>
        <UsernameField value={username} onChange={setUsername} fullName={name} onReady={setReady} required autoFocus />
        <div className="onboarding-error">{error}</div>
        <button className="btn-primary" onClick={submit} disabled={busy || !ready}>
          {busy ? "Un moment..." : "Continua"}
        </button>
      </div>
    </div>
  );
}
