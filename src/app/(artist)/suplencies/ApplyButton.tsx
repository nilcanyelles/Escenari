"use client";

import { useState, useTransition } from "react";
import { applyToBackupRequestAction } from "../actions";

export default function ApplyButton({ requestId, status }: { requestId: string; status: "pendent" | "acceptada" | "rebutjada" | null }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [applied, setApplied] = useState(status !== null);
  const [pending, startTransition] = useTransition();

  if (status === "acceptada") return <span className="badge" style={{ background: "oklch(0.72 0.15 155 / 0.16)", color: "oklch(0.78 0.15 155)" }}>acceptada ✓</span>;
  if (status === "rebutjada") return <span className="badge">no seleccionat</span>;
  if (applied) return <span className="badge" style={{ background: "oklch(0.78 0.15 80 / 0.16)", color: "oklch(0.82 0.15 80)" }}>candidatura enviada</span>;

  return open ? (
    <div className="apply-form">
      <input
        className="field-input compact-field"
        placeholder="Missatge (opcional)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button
        type="button" className="btn-save" disabled={pending}
        onClick={() => startTransition(async () => {
          const res = await applyToBackupRequestAction(requestId, message);
          if (res.ok) setApplied(true);
        })}
      >Presenta&apos;t</button>
    </div>
  ) : (
    <button type="button" className="btn-outline" onClick={() => setOpen(true)}>M&apos;interessa</button>
  );
}
