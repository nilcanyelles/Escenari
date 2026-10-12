"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

// Avís que apareix quan s'ha canviat automàticament la vista de gestor a
// músic (p. ex. en entrar per un enllaç d'invitació de grup) — es mostra
// un moment i neteja el paràmetre "switched" de la URL perquè no torni a
// sortir en refrescar la pàgina.
export default function ViewSwitchToast() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (searchParams.get("switched") !== "artist") return;
    setShow(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("switched");
    const next = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(next, { scroll: false });
    const t = window.setTimeout(() => setShow(false), 5000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={"toast" + (show ? " show" : "")}>
      Compte canviat a perfil de músic — pots tornar a canviar a perfil de gestor des del perfil personal.
    </div>
  );
}
