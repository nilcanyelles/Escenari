"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { SignOutButton } from "@clerk/nextjs";
import { IconSwap } from "@/components/RailIcons";

// Botons que abans vivien al desplegable de l'avatar (vist a dalt a la
// dreta): alternar entre vista de gestor/músic i tancar sessió. Ara surten
// al peu de la pestanya "Perfil personal" de cadascuna de les dues àrees.
export default function ProfileViewSwitch({ switchView }: {
  switchView?: { href: string; label: string; mode: "manager" | "artist" };
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function go() {
    if (!switchView) return;
    document.cookie = `escenari_view=${switchView.mode}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => { router.push(switchView.href); router.refresh(); });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 320 }}>
      {switchView && (
        <button type="button" className="btn-outline" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }} onClick={go}>
          <IconSwap /> {switchView.label}
        </button>
      )}
      <SignOutButton redirectUrl="/">
        <button className="btn-danger-outline" type="button">Tanca sessió</button>
      </SignOutButton>
    </div>
  );
}
