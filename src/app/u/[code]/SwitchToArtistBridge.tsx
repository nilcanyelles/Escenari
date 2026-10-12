"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const VIEW_COOKIE = "escenari_view";

// Mateix mecanisme que el botó "Vista de músic" del perfil (AppShell.tsx):
// una cookie, cap canvi de compte. Un gestor que arriba per un enllaç
// d'invitació hi entra directament com a músic, sense cap pantalla de
// bloqueig pel mig.
export default function SwitchToArtistBridge({ next }: { next: string }) {
  const router = useRouter();
  useEffect(() => {
    document.cookie = `${VIEW_COOKIE}=artist; path=/; max-age=31536000; samesite=lax`;
    router.replace(next);
  }, [next, router]);
  return <p className="onboarding-sub">Un moment…</p>;
}
