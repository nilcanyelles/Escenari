"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinByCodeAction } from "../actions";

export default function JoinByCode() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (pending || !code.trim()) return;
    startTransition(async () => {
      const result = await joinByCodeAction(code);
      if (!result.ok) {
        setMessage({ text: result.error, ok: false });
      } else {
        setMessage({ text: `Ja formes part de ${result.bandName}!`, ok: true });
        setCode("");
        router.refresh();
      }
    });
  }

  return (
    <div>
      <div className="join-code-form">
        <input
          className="field-input"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="ABC123"
          maxLength={6}
        />
        <button className="btn-primary" style={{ whiteSpace: "nowrap" }} type="button" disabled={pending} onClick={submit}>
          {pending ? "..." : "Uneix-m'hi"}
        </button>
      </div>
      {message && (
        <div style={{ marginTop: 8, fontSize: 13, color: message.ok ? "oklch(0.78 0.15 155)" : "var(--red)" }}>
          {message.text}
        </div>
      )}
    </div>
  );
}
