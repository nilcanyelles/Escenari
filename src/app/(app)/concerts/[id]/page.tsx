import { notFound } from "next/navigation";
import ConcertDetailView from "@/components/ConcertDetailView";
import { getBands, getConcertById, getConcertsOnDate, getVenueHistory, getInvoiceForConcert, getCompanyInfo, getClientDetails, getContacts } from "@/lib/data";
import { getLinkedMembers } from "@/lib/group-data";
import { getBackupRequests } from "@/lib/group-data";
import { getShareLinks } from "@/lib/share-data";
import { getRiders, getSetlists, getRiderApprovals } from "@/lib/material-data";
import { getTransactions } from "@/lib/finance";
import { normalize } from "@/lib/text";
import { daysBetween } from "@/lib/format";
import { emailConfigured } from "@/lib/email";
import { today } from "@/lib/format";
import { requireManager } from "@/lib/current-user";
import { getWorkspaceBilling, activeLinksForConcert } from "@/lib/billing";
import { ensureShareLinkForConcert } from "@/app/(app)/concerts/share-actions";
import { getUnavailabilityTitlesOnDate } from "@/lib/unavailability";

export const dynamic = "force-dynamic";

export default async function ConcertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspaceId, name: managerName, agencyOwner } = await requireManager();
  // Un sol concert per id (i factura pel seu id), no tot l'historial del
  // workspace només per fer-hi un .find() — vegeu getConcertById/
  // getInvoiceForConcert a data.ts.
  const [concert, bands, companyInfo, clientDetails, contacts, billing, links] = await Promise.all([
    getConcertById(workspaceId, id),
    getBands(workspaceId), getCompanyInfo(workspaceId), getClientDetails(workspaceId), getContacts(workspaceId),
    getWorkspaceBilling(workspaceId), activeLinksForConcert(workspaceId, id),
  ]);
  if (!concert) notFound();

  const band = bands.find((b) => b.id === concert.bandId) || null;
  // Bolos creats abans d'aquesta funcionalitat (o per qualsevol altre camí):
  // l'enllaç de regidor s'hi afegeix ara mateix, aquí, si encara no en té.
  await ensureShareLinkForConcert(id, workspaceId);
  // Aquestes consultes són totes independents entre si (cap depèn del
  // resultat de cap altra), així que van juntes en un sol Promise.all en
  // comptes d'esperar-les una darrere l'altra — abans transactions i les
  // fotos de perfil s'esperaven a part, afegint dues volteres més de
  // llatència a cada càrrega de la pàgina.
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
      // Fotos reals de perfil per a les llistes d'assistència i repartiment.
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

  // Qui dels convocats amb compte d'Escenari s'ha marcat "no disponible" al
  // seu perfil personal aquest mateix dia — avís a la pestanya Convocatòria.
  const unavailTitles = await getUnavailabilityTitlesOnDate(linkedMembers.map((lm) => lm.clerkUserId), concert.date);
  const unavailByMember: Record<string, string> = {};
  linkedMembers.forEach((lm) => { if (unavailTitles[lm.clerkUserId]) unavailByMember[lm.memberName] = unavailTitles[lm.clerkUserId]; });

  // Conflictes: només quan coincideixen dia I hora — mateix grup, o un membre
  // compromès amb un altre grup a la mateixa hora. (clashConcerts ja només
  // conté esdeveniments del mateix dia, sense cancel·lats ni aquest mateix.)
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

  // Historial del client/recinte: què s'hi ha cobrat i com han pagat.
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
