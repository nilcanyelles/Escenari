"use client";

import { useEffect, useRef, useState } from "react";
import { checkUsernameAction } from "@/app/onboarding/actions";
import { slugifyUsername } from "@/lib/username";

type Status = "idle" | "checking" | "ok" | "taken" | "invalid";

// Camp de nom d'usuari (@...), amb comprovació de disponibilitat en viu
// (tick verd si és lliure, text vermell + "Usuari no disponible" si no) i
// suggeriments clicables — a partir del nom mentre el camp és buit, o amb
// un sufix numèric quan el triat ja existeix. "onReady" avisa el pare de
// si l'estat actual es pot enviar (per activar/desactivar "Continua").
export default function UsernameField({ value, onChange, fullName, onReady, required = false, excludeUsername, autoFocus = false }: {
  value: string; onChange: (v: string) => void; fullName: string; onReady?: (ok: boolean) => void; required?: boolean; excludeUsername?: string; autoFocus?: boolean;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const timer = useRef<number | null>(null);
  const reqId = useRef(0);

  function runCheck(v: string) {
    const id = ++reqId.current;
    setStatus("checking");
    checkUsernameAction(v, fullName, excludeUsername).then((r) => {
      if (id !== reqId.current) return; // resposta obsoleta, n'hi ha una de més nova en camí
      setSuggestions(r.suggestions);
      if (!v) { setStatus("idle"); return; }
      if (!r.valid) { setStatus("invalid"); return; }
      setStatus(r.available ? "ok" : "taken");
    });
  }

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => runCheck(value), 300);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, fullName, excludeUsername]);

  useEffect(() => { onReady?.(status === "ok"); }, [status, onReady]);

  function pick(s: string) {
    onChange(s);
    runCheck(s);
  }

  return (
    <div className="field-group">
      <label className="field-label">Nom d&apos;usuari{required && <span className="field-required" title="Obligatori">*</span>}</label>
      <div className={"username-field" + (status === "taken" || status === "invalid" ? " invalid" : "")}>
        <span className="username-field-at">@</span>
        <input
          className="field-input username-field-input"
          value={value}
          onChange={(e) => onChange(slugifyUsername(e.target.value))}
          placeholder="nomusuari"
          autoFocus={autoFocus}
        />
        {status === "ok" && (
          <span className="username-field-tick" title="Disponible">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </span>
        )}
      </div>
      {(status === "taken" || status === "invalid") && (
        <div className="username-field-msg">
          {status === "taken" ? "Usuari no disponible" : "Nom d'usuari no vàlid (mínim 3 lletres/números)"}
        </div>
      )}
      {suggestions.length > 0 && (status !== "ok") && (
        <div className="username-suggestions">
          {suggestions.map((s) => (
            <button type="button" key={s} className="username-suggestion" onClick={() => pick(s)}>@{s}</button>
          ))}
        </div>
      )}
    </div>
  );
}
