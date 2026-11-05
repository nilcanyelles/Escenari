"use client";

import { useState } from "react";
import UsernameField from "@/components/UsernameField";
import { updateUsernameAction } from "@/app/p/profile-actions";

function EditIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
  );
}

// Nom d'usuari (@...) del propi compte — es mostra sota el nom a "El teu
// perfil"; amb el llapis s'obre l'edició (mateix camp i comprovació de
// disponibilitat que a l'alta), sense poder repetir-ne un ja existent.
export default function UsernameSettingRow({ username, fullName, prominent = false }: { username: string; fullName: string; prominent?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(username);
  const [ready, setReady] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(username);

  async function save() {
    if (!ready || saving) return;
    setSaving(true);
    setError("");
    const res = await updateUsernameAction(draft);
    setSaving(false);
    if (!res.ok) { setError(res.error || "No s'ha pogut desar."); return; }
    setSaved(draft);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className={"username-row" + (prominent ? " prominent" : "")}>
        <span className={prominent ? "pv-ig" : "username-row-value"}>@{saved}</span>
        <button type="button" className="username-row-edit" title="Canvia el nom d'usuari" onClick={() => { setDraft(saved); setEditing(true); }}>
          <EditIcon />
        </button>
      </div>
    );
  }

  return (
    <div className="username-row-edit-wrap">
      <UsernameField value={draft} onChange={setDraft} fullName={fullName} onReady={setReady} excludeUsername={saved} autoFocus />
      {error && <div className="username-field-msg">{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn-outline" onClick={() => { setEditing(false); setError(""); }}>Cancel·la</button>
        <button type="button" className="btn-save" disabled={!ready || saving} onClick={save}>{saving ? "Desant…" : "Desa"}</button>
      </div>
    </div>
  );
}
