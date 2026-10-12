"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Embolcall per a una ruta interceptada (p. ex. /concerts/[id] obert des
// de la llista): mostra exactament el mateix contingut que la pàgina
// sencera, però com a finestra emergent per sobre de la llista. Tancar-la
// (fons, tecla Esc, o el propi "Torna") fa history.back() — torna a la
// llista tal com estava, sense recarregar-la.
export default function RouteModalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  function close() {
    router.back();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="route-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="route-modal-panel">
        <button type="button" className="route-modal-close" title="Tanca" aria-label="Tanca" onClick={close}>✕</button>
        {children}
      </div>
    </div>
  );
}
