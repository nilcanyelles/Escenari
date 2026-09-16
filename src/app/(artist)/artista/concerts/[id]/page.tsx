import { notFound } from "next/navigation";
import ArtistConcertDetail from "@/components/ArtistConcertDetail";
import ConcertDetailView from "@/components/ConcertDetailView";
import { requireArtist } from "@/lib/current-user";
import { getArtistBandsFull, getArtistConcertsFull } from "@/lib/artist-data";
import { getBands, getConcerts, getInvoices, getCompanyInfo, getClientDetails, getContacts } from "@/lib/data";
import { getSetlists, getRiders, getRiderApprovals } from "@/lib/material-data";
import { getLinkedMembers, getBackupRequests } from "@/lib/group-data";
import { getShareLinks } from "@/lib/share-data";
import { getTransactions } from "@/lib/finance";
import { memberPerms } from "@/lib/perms";
import { computePayouts, myPayout } from "@/lib/payouts";
import { today, daysBetween } from "@/lib/format";
import { normalize } from "@/lib/text";
import { emailConfigured } from "@/lib/email";
import { getWorkspaceBilling, activeLinksForConcert } from "@/lib/billing";
import { ensureShareLinkForConcert } from "@/app/(app)/concerts/share-actions";
import { getUnavailabilityTitlesOnDate } from "@/lib/unavailability";
import { db } from "@/lib/db";
import type { Band } from "@/lib/types";

export const dynamic = "force-dynamic";

// Músic o crew — els permisos es guarden a totes dues llistes de members.
function permsForMember(band: Band | null, name: string) {
  if (!band) return memberPerms(null);
  const me = (band.members || []).find((m) => normalize(m.name) === normalize(name)) ||
    (band.crew || []).find((m) => normalize(m.name) === normalize(name)) || null;
  return memberPerms(me);
}

// Fitxa d'un concert per a un músic. Qui és Admin del grup hi veu i hi pot
// fer exactament el mateix que el gestor (ConcertDetailView, el mateix
// component — no una versió reduïda): informació, full de ruta,
// assistència, diners, factures i contractes. La resta de músics/crew,
// la fitxa reduïda de sempre (ArtistConcertDetail).
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
  const perms = permsForMember(band, myName);
  const isAdmin = perms.admin;

  const wsRow = (await db().query("select workspace_id from bands where id=$1", [concert.bandId])).rows[0];
  const workspaceId: string | undefined = wsRow?.workspace_id;

  if (isAdmin && workspaceId && band) {
    // Mateixa font de dades que la fitxa del gestor, però escopada al
    // workspace d'aquest grup (que l'admin no té al seu propi perfil —
    // ell continua sent artista) en comptes del del gestor.
    await ensureShareLinkForConcert(id, workspaceId);
    const [fullBands, fullConcerts, invoices, companyInfo, clientDetails, contacts, billing, activeLinks,
      linkedMembers, shareLinks, backupRequests, riders, setlists, riderApprovals, transactions, photoRows] = await Promise.all([
      getBands(workspaceId), getConcerts(workspaceId), getInvoices(workspaceId), getCompanyInfo(workspaceId),
      getClientDetails(workspaceId), getContacts(workspaceId), getWorkspaceBilling(workspaceId), activeLinksForConcert(workspaceId, id),
      getLinkedMembers(band.id), getShareLinks(workspaceId, id), getBackupRequests(workspaceId, { concertId: id }),
      getRiders(band.id), getSetlists(band.id), getRiderApprovals(workspaceId, id), getTransactions(workspaceId),
      db().query(
        "select person_name, photo_file_id from person_profiles where workspace_id=$1 and photo_file_id is not null",
        [workspaceId]
      ).then((r) => r.rows as { person_name: string; photo_file_id: string }[]),
    ]);
    const fullConcert = fullConcerts.find((c) => c.id === id);
    if (!fullConcert) notFound();
    const concertExpenses = transactions.filter((t) => t.concertId === id && t.kind === "despesa");
    const photosByName: Record<string, string> = {};
    photoRows.forEach((r) => { photosByName[normalize(r.person_name)] = r.photo_file_id; });

    // Qui dels convocats amb compte d'Escenari s'ha marcat "no disponible"
    // al seu perfil personal aquest mateix dia — avís a la Convocatòria.
    const unavailTitles = await getUnavailabilityTitlesOnDate(linkedMembers.map((lm) => lm.clerkUserId), fullConcert.date);
    const unavailByMember: Record<string, string> = {};
    linkedMembers.forEach((lm) => { if (unavailTitles[lm.clerkUserId]) unavailByMember[lm.memberName] = unavailTitles[lm.clerkUserId]; });

    // Conflictes del mateix grup (mateix dia i hora) — entre grups d'altres
    // admins de l'agència no es comproven aquí (no en veiem la formació).
    const clashes: string[] = [];
    if (fullConcert.status !== "cancel·lat") {
      fullConcerts.forEach((o) => {
        if (o.id === id || o.bandId !== fullConcert.bandId || o.date !== fullConcert.date || o.time !== fullConcert.time || o.status === "cancel·lat") return;
        clashes.push(`${fullConcert.bandName} ja té un altre esdeveniment el mateix dia i hora: ${o.city || o.venue || o.id} (${o.status}).`);
      });
    }

    const venueKey = normalize(fullConcert.venue);
    const venueHistory = venueKey
      ? fullConcerts
          .filter((c) => c.id !== id && c.bandId === fullConcert.bandId && normalize(c.venue) === venueKey && c.status !== "cancel·lat")
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 8)
          .map((c) => {
            const inv = invoices.find((i) => i.concertId === c.id) || null;
            return {
              date: c.date, amount: c.amount, invoiceState: inv?.state || null,
              daysToPay: inv && inv.state === "pagada" ? Math.max(0, daysBetween(inv.issueDate, inv.dueDate)) : null,
            };
          })
      : [];

    return (
      <ConcertDetailView
        concert={fullConcert}
        band={band}
        bands={[band]}
        invoice={invoices.find((i) => i.concertId === id) || null}
        companyInfo={companyInfo}
        clientDetails={clientDetails}
        contacts={contacts}
        linkedMembers={linkedMembers}
        unavailByMember={unavailByMember}
        shareLinks={shareLinks}
        backupRequests={backupRequests}
        riders={riders}
        setlists={setlists}
        riderApprovals={riderApprovals}
        clashes={clashes}
        venueHistory={venueHistory}
        concertExpenses={concertExpenses}
        emailReady={emailConfigured()}
        photosByName={photosByName}
        today={today()}
        managerName={profile.name}
        billing={billing}
        activeLinks={activeLinks}
        canUpgrade={false}
        base="/artista"
      />
    );
  }

  const [setlists, linkedMembers, raw, txs, photoRows] = await Promise.all([
    band ? getSetlists(band.id) : Promise.resolve([]),
    band ? getLinkedMembers(band.id) : Promise.resolve([]),
    db().query("select amount, agency_pct, agency_assumes_expenses, payouts from concerts where id=$1", [id]).then((r) => r.rows[0] || null),
    workspaceId ? getTransactions(workspaceId) : Promise.resolve([]),
    workspaceId ? db().query(
      "select person_name, photo_file_id from person_profiles where workspace_id=$1 and photo_file_id is not null",
      [workspaceId]
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
