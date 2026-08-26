import { notFound } from "next/navigation";
import ArtistConcertDetail from "@/components/ArtistConcertDetail";
import { requireArtist } from "@/lib/current-user";
import { getArtistBandsFull, getArtistConcertsFull } from "@/lib/artist-data";
import { today } from "@/lib/format";
import { normalize } from "@/lib/text";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ArtistConcertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireArtist();
  const [bands, concerts] = await Promise.all([
    getArtistBandsFull(profile.clerkUserId),
    getArtistConcertsFull(profile.clerkUserId),
  ]);
  const concert = concerts.find((c) => c.id === id);
  if (!concert) notFound();
  const band = bands.find((b) => b.id === concert.bandId) || null;

  const link = (await db().query(
    "select member_name from band_members where band_id=$1 and clerk_user_id=$2",
    [concert.bandId, profile.clerkUserId]
  )).rows[0];
  const myName = link?.member_name || profile.name;

  // El seu caixet: l'entrada del repartiment amb el seu nom (si n'hi ha).
  const payouts = concert.payouts || {};
  const payoutKey = Object.keys(payouts).find((k) => normalize(k) === normalize(myName));
  const myAmount = payoutKey !== undefined ? payouts[payoutKey] : null;

  return (
    <ArtistConcertDetail
      concert={concert}
      band={band}
      myName={myName}
      myAmount={myAmount}
      showFees={!!band?.showFees}
      today={today()}
    />
  );
}
