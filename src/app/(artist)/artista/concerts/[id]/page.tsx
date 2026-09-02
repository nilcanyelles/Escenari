import { notFound } from "next/navigation";
import ArtistConcertDetail from "@/components/ArtistConcertDetail";
import { requireArtist } from "@/lib/current-user";
import { getArtistBandsFull, getArtistConcertsFull } from "@/lib/artist-data";
import { getSetlists } from "@/lib/material-data";
import { memberPerms } from "@/lib/perms";
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

  // Setlists del grup i si aquest membre pot assignar-les a l'esdeveniment.
  const setlists = band ? await getSetlists(band.id) : [];
  const me = (band?.members || []).find((m) => normalize(m.name) === normalize(myName)) || null;
  const canSetlists = memberPerms(me).setlists;

  // Fotos reals per a la llista d'assistència.
  const ws = (await db().query("select workspace_id from bands where id=$1", [concert.bandId])).rows[0];
  const photoRows = ws ? (await db().query(
    "select person_name, photo_file_id from person_profiles where workspace_id=$1 and photo_file_id is not null",
    [ws.workspace_id]
  )).rows : [];
  const photosByName: Record<string, string> = {};
  photoRows.forEach((r) => { photosByName[normalize(r.person_name)] = r.photo_file_id; });

  return (
    <ArtistConcertDetail
      concert={concert}
      band={band}
      myName={myName}
      myAmount={myAmount}
      showFees={!!band?.showFees}
      photosByName={photosByName}
      setlists={setlists}
      canSetlists={canSetlists}
      today={today()}
    />
  );
}
