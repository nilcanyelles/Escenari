import { notFound } from "next/navigation";
import ArtistConcertDetail from "@/components/ArtistConcertDetail";
import { requireArtist } from "@/lib/current-user";
import { getArtistBandsFull, getArtistConcertsFull } from "@/lib/artist-data";
import { getSetlists } from "@/lib/material-data";
import { getLinkedMembers } from "@/lib/group-data";
import { getTransactions } from "@/lib/finance";
import { memberPerms } from "@/lib/perms";
import { computePayouts, myPayout } from "@/lib/payouts";
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
  const me = (band?.members || []).find((m) => normalize(m.name) === normalize(myName)) || null;
  const perms = memberPerms(me);
  const isAdmin = perms.admin;

  const ws = (await db().query("select workspace_id from bands where id=$1", [concert.bandId])).rows[0];
  const [setlists, linkedMembers, raw, txs, photoRows] = await Promise.all([
    band ? getSetlists(band.id) : Promise.resolve([]),
    band ? getLinkedMembers(band.id) : Promise.resolve([]),
    // Caixet real i repartiment desat (el carregador d'artista amaga el
    // caixet si el grup no el mostra; aquí es calcula el que toca a cadascú
    // igual que a la fitxa del gestor, i només es mostra el que correspon).
    db().query("select amount, agency_pct, agency_assumes_expenses, payouts from concerts where id=$1", [id]).then((r) => r.rows[0] || null),
    ws ? getTransactions(ws.workspace_id) : Promise.resolve([]),
    // Fotos reals per a les llistes d'assistència i repartiment.
    ws ? db().query(
      "select person_name, photo_file_id from person_profiles where workspace_id=$1 and photo_file_id is not null",
      [ws.workspace_id]
    ).then((r) => r.rows) : Promise.resolve([]),
  ]);
  const expenseTxs = txs.filter((t) => t.concertId === id && t.kind === "despesa");
  const summary = computePayouts(
    {
      attendance: concert.attendance, substitutes: concert.substitutes,
      amount: Number(raw?.amount) || 0,
      payouts: (raw?.payouts as Record<string, number>) || {},
      agencyPct: raw?.agency_pct == null ? undefined : Number(raw.agency_pct),
      agencyAssumesExpenses: raw?.agency_assumes_expenses !== false,
    },
    band,
    expenseTxs
  );
  const myAmount = myPayout(summary.payouts, myName);

  const photosByName: Record<string, string> = {};
  photoRows.forEach((r) => { photosByName[normalize(r.person_name)] = r.photo_file_id; });

  return (
    <ArtistConcertDetail
      concert={concert}
      band={band}
      myName={myName}
      myAmount={myAmount}
      showFees={!!band?.showFees}
      isAdmin={isAdmin}
      money={isAdmin ? summary : null}
      photosByName={photosByName}
      setlists={setlists}
      canSetlists={perms.setlists}
      linkedNames={linkedMembers.map((m) => m.memberName)}
      today={today()}
    />
  );
}
