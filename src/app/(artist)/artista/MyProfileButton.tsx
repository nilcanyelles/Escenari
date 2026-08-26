"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { openMyProfileAction } from "@/app/p/profile-actions";

// Porta l'artista al seu perfil públic compartible (i el crea si cal).
export default function MyProfileButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button" className="link-btn" style={{ fontSize: 12.5 }} disabled={busy}
      onClick={async () => {
        setBusy(true);
        const { token } = await openMyProfileAction();
        if (token) router.push(`/p/${token}`);
        else alert("Uneix-te a un grup per tenir perfil públic.");
        setBusy(false);
      }}
    >👤 {busy ? "Obrint…" : "El meu perfil"}</button>
  );
}
