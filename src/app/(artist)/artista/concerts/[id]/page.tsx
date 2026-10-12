import ArtistConcertDetailContent from "./ArtistConcertDetailContent";

export const dynamic = "force-dynamic";

export default async function ArtistConcertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ArtistConcertDetailContent id={id} />;
}
