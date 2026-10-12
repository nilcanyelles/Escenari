import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// La fitxa d'un esdeveniment només es veu/edita com a finestra emergent
// (@modal/(.)concerts/[id], des de la llista) — aquesta ruta sencera ja no
// renderitza mai el contingut, per no fer-lo "parpellejar" un instant com
// a pàgina completa abans que la finestra emergent la substitueixi quan
// s'hi arriba directament (URL, refresc...).
export default async function ConcertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await params;
  redirect("/concerts");
}
