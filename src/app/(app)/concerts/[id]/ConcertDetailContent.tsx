import { notFound } from "next/navigation";
import ConcertDetailView from "@/components/ConcertDetailView";
import { getBands, getConcertById, getConcertsOnDate, getVenueHistory, getInvoiceForConcert, getCompanyInfo, getClientDetails, getContacts } from "@/lib/data";
import { getLinkedMembers } from "@/lib/group-data";
import { getBackupRequests } from "@/lib/group-data";
import { getShareLinks } from "@/lib/share-data";
import { getRiders, getSetlists, getRiderApprovals } from "@/lib/material-data";
import { getTransactions } from "@/lib/finance";
import { normalize } from "@/lib/text";
import { daysBetween, today } from "@/lib/format";
import { emailConfigured } from "@/lib/email";
import { requireManager } from "@/lib/current-user";
import { getWorkspaceBilling, activeLinksForConcert } from "@/lib/billing";
import { ensureShareLinkForConcert } from "@/app/(app)/concerts/share-actions";
import { getUnavailabilityTitlesOnDate } from "@/lib/unavailability";

// Tota la càrrega de dades i el render de la fitxa d'un concert pel
// gestor — la mateixa, tant si s'hi arriba per la pàgina sencera
// (/concerts/[id]) com per la finestra emergent interceptada
// (@modal/(.)concerts/[id]), perquè totes dues en fan exactament el
// mateix ús sense duplicar-ne la lògica.
export default async function ConcertDetailContent({ id }: { id: string }) {
  const { workspaceId, name: managerName, agencyOwner } = await requireManager();
  const [concert, bands, companyInfo, clientDetails, contacts, billing, links] = await Promise.all([
    getConcertById(workspaceId, id),
    getBands(workspaceId), getCompanyInfo(workspaceId), getClientDetails(workspaceId), getContacts(workspaceId),
    getWorkspaceBilling(workspaceId), activeLinksForConcert(workspaceId, id),
  ]);
  if (!concert) notFound();

  const band = bands.find((b) => b.id === concert.bandId) || null;
  await ensureShareLinkForConcert(id, workspaceId);
  const [linkedMembers, shareLinks, backupRequests, riders, setlists, riderApprovals, transactions, invoice, clashConcerts, venueHistoryConcerts, photoRows] = await Promise.all([
    band ? getLinkedMembers(band.id) : Promise.resolve([]),
    getShareLinks(workspaceId, id),
    getBackupRequests(workspaceId, { concertId: id }),
    band ? getRiders(band.id) : Promise.resolve([]),
    band ? getSetlists(band.id) : Promise.resolve([]),
    getRiderApprovals(workspaceId, id),
    getTransactions(workspaceId),
    getInvoiceForConcert(workspaceId, id),
    concert.status !== "cancel·lat" ? getConcertsOnDate(workspaceId, concert.date, id) : Promise.resolve([]),
    getVenueHistory(workspaceId, concert.venue, id),
    (async () => {
      const { db } = await import("@/lib/db");
      return (await db().query(
        "select person_name, photo_file_id from person_profiles where workspace_id=$1 and photo_file_id is not null",
        [workspaceId]
      )).rows as { person_name: string; photo_file_id: string }[];
    })(),
  ]);
  const concertExpenses = transactions.filter((t) => t.concertId === id && t.kind === "despesa");
  const photosByName: Record<string, string> = {};
  photoRows.forEach((r) => { photosByName[normalize(r.person_name)] = r.photo_file_id; });

  const unavailTitles = await getUnavailabilityTitlesOnDate(linkedMembers.map((lm) => lm.clerkUserId), concert.date);
  const unavailByMember: Record<string, string> = {};
  linkedMembers.forEach((lm) => { if (unavailTitles[lm.clerkUserId]) unavailByMember[lm.memberName] = unavailTitles[lm.clerkUserId]; });

  const clashes: string[] = [];
  if (concert.status !== "cancel·lat") {
    const memberNames = new Set((band?.members || []).map((m) => m.name.toLowerCase()));
    clashConcerts.forEach((o) => {
      if (o.time !== concert.time) return;
      if (o.bandId === concert.bandId) {
        clashes.push(`${concert.bandName} ja té un altre esdeveniment el mateix dia i hora: ${o.city || o.venue || o.id} (${o.status}).`);
        return;
      }
      const otherBand = bands.find((b) => b.id === o.bandId);
      const shared = (otherBand?.members || []).filter((m) => memberNames.has(m.name.toLowerCase())).map((m) => m.name);
      if (shared.length) {
        clashes.push(`${shared.join(", ")} també ${shared.length === 1 ? "toca" : "toquen"} amb ${o.bandName} a la mateixa hora (${o.city || o.venue || "—"}).`);
      }
    });
  }

  const venueHistory = await Promise.all(
    venueHistoryConcerts.map(async (c) => {
      const inv = await getInvoiceForConcert(workspaceId, c.id);
      return {
        date: c.date,
        amount: c.amount,
        invoiceState: inv?.state || null,
        daysToPay: inv && inv.state === "pagada" ? Math.max(0, daysBetween(inv.issueDate, inv.dueDate)) : null,
      };
    })
  );

  return (
    <ConcertDetailView
      concert={concert}
      band={band}
      bands={bands}
      invoice={invoice}
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
      managerName={managerName}
      billing={billing}
      activeLinks={links}
      canUpgrade={agencyOwner}
    />
  );
}
