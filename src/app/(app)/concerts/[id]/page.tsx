import ConcertDetailContent from "./ConcertDetailContent";

export const dynamic = "force-dynamic";

export default async function ConcertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ConcertDetailContent id={id} />;
}
