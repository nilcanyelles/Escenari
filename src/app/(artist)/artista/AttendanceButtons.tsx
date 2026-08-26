"use client";

import { useState, useTransition } from "react";
import { setMyAttendanceAction, suggestSubstituteAction, publishBackupSearchAction } from "../actions";

export default function AttendanceButtons({
  concertId,
  current,
  currentSubstitute = "",
  searchPublished = false,
  backups = [],
}: {
  concertId: string;
  current: "yes" | "no" | null;
  currentSubstitute?: string;
  searchPublished?: boolean;
  backups?: { name: string; instruments: string[] }[];
}) {
  const [value, setValue] = useState(current);
  const [substitute, setSubstitute] = useState(currentSubstitute);
  const [published, setPublished] = useState(searchPublished);
  const [pending, startTransition] = useTransition();

  function choose(next: "yes" | "no") {
    if (pending) return;
    setValue(next);
    if (next === "yes") { setSubstitute(""); setPublished(false); }
    startTransition(async () => {
      await setMyAttendanceAction(concertId, next);
    });
  }

  return (
    <div className="attendance-wrap">
      <div className="attendance-btns">
        <button
          className={"attendance-btn yes" + (value === "yes" ? " active" : "")}
          onClick={() => choose("yes")}
          type="button"
        >
          Hi seré
        </button>
        <button
          className={"attendance-btn no" + (value === "no" ? " active" : "")}
          onClick={() => choose("no")}
          type="button"
        >
          No puc
        </button>
      </div>

      {value === "no" && (
        <div className="attendance-no-options">
          {backups.length > 0 && (
            <select
              className="field-input compact-field"
              value={substitute}
              onChange={(e) => {
                const v = e.target.value;
                setSubstitute(v);
                startTransition(async () => { await suggestSubstituteAction(concertId, v); });
              }}
            >
              <option value="">Proposa un suplent…</option>
              {backups.map((b) => (
                <option key={b.name} value={b.name}>{b.name}{b.instruments.length ? ` (${b.instruments.join(", ")})` : ""}</option>
              ))}
            </select>
          )}
          {!substitute && (
            published ? (
              <span className="attendance-published">Cerca de suplent publicada ✓</span>
            ) : (
              <button
                type="button"
                className="attendance-publish-btn"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const res = await publishBackupSearchAction(concertId);
                    if (res?.ok) setPublished(true);
                  });
                }}
              >
                {backups.length ? "Cap m'encaixa — busca suplent" : "Busca un suplent a Escenari"}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
