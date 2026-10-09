import { cookies } from "next/headers";

export const VIEW_COOKIE = "escenari_view";

// Un gestor que també toca en algun grup pot triar veure l'àrea de músic en
// comptes de la de gestió, sense canviar de compte — es guarda en una
// cookie (com escenari_band) perquè totes les pàgines la comparteixin.
// Els comptes purs (gestor sense tocar enlloc, o músic sense grup propi) no
// en fan cap ús: només hi ha res a triar quan les dues àrees existeixen de
// veritat per al mateix compte.
export async function getViewMode(): Promise<"manager" | "artist" | null> {
  const store = await cookies();
  const v = store.get(VIEW_COOKIE)?.value;
  return v === "manager" || v === "artist" ? v : null;
}
