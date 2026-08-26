"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setSubsAvailabilityAction } from "../actions";

// El músic marca si vol que el tinguin en compte per a suplències i si el seu
// perfil és visible per als gestors que en busquen.
export default function AvailabilityBox({ open, visible }: { open: boolean; visible: boolean }) {
  const router = useRouter();
  const [state, setState] = useState({ open, visible });

  async function toggle(key: "open" | "visible") {
    const next = { ...state, [key]: !state[key] };
    setState(next);
    await setSubsAvailabilityAction(key === "open" ? { open: next.open } : { visible: next.visible });
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
    </div>
  );
}
