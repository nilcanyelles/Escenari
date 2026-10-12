import RouteModalShell from "@/components/RouteModalShell";
import ArtistConcertDetailContent from "@/app/(artist)/artista/concerts/[id]/ArtistConcertDetailContent";

export const dynamic = "force-dynamic";

export default async function ArtistConcertDetailModal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RouteModalShell>
      <ArtistConcertDetailContent id={id} />
    </RouteModalShell>
  );
}
