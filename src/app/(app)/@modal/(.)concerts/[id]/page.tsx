import RouteModalShell from "@/components/RouteModalShell";
import ConcertDetailContent from "@/app/(app)/concerts/[id]/ConcertDetailContent";

export const dynamic = "force-dynamic";

// Interceptada: en navegar-hi des de la llista d'esdeveniments (clic a una
// fila, o en crear-ne un de nou), aquesta versió substitueix la pàgina
// sencera per una finestra emergent amb exactament el mateix contingut
// (ConcertDetailContent, compartit amb /concerts/[id]/page.tsx). En
// recarregar o entrar-hi directament per URL, es veu la pàgina sencera.
export default async function ConcertDetailModal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RouteModalShell>
      <ConcertDetailContent id={id} />
    </RouteModalShell>
  );
}
