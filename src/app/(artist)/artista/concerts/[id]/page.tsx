import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Mateix motiu que la pàgina equivalent del gestor: la fitxa només es veu
// com a finestra emergent des de la llista.
export default async function ArtistConcertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await params;
  redirect("/artista/concerts");
}
