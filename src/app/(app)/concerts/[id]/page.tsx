import { notFound } from "next/navigation";
import ConcertDetailView from "@/components/ConcertDetailView";
import { getBands, getConcerts, getInvoices, getCompanyInfo, getClientDetails } from "@/lib/data";
import { getLinkedMembers } from "@/lib/group-data";
import { getBackupRequests } from "@/lib/group-data";
import { getShareLinks } from "@/lib/share-data";
import { getRiders, getSetlists, getRiderApprovals } from "@/lib/material-data";
import { getChecklists } from "@/lib/checklists";
import { getTransactions } from "@/lib/finance";
import { normalize } from "@/lib/text";
import { daysBetween } from "@/lib/format";
import { emailConfigured } from "@/lib/email";
import { today } from "@/lib/format";
import { requireManager } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function ConcertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspaceId } = await requireManager();
  const [bands, concerts, invoices, companyInfo, clientDetails] = await Promise.all([
    getBands(workspaceId), getConcerts(workspaceId), getInvoices(workspaceId), getCompanyInfo(workspaceId), getClientDetails(workspaceId),
  ]);
  const concert = concerts.find((c) => c.id === id);
  if (!concert) notFound();

  const band = bands.find((b) => b.id === concert.bandId) || null;
  const [linkedMembers, shareLinks, backupRequests, riders, setlists, riderApprovals, checklists] = await Promise.all([
    band ? getLinkedMembers(band.id) : Promise.resolve([]),
    getShareLinks(workspaceId, id),
    getBackupRequests(workspaceId, { concertId: id }),
    band ? getRiders(band.id) : Promise.resolve([]),
    band ? getSetlists(band.id) : Promise.resolve([]),
    getRiderApprovals(workspaceId, id),
    getChecklists(workspaceId, id),
  ]);
  const transactions = await getTransactions(workspaceId);
  const concertExpenses = transactions.filter((t) => t.concertId === id && t.kind === "despesa");

  // Conflictes: només quan coincideixen dia I hora — mateix grup, o un membre
  // compromès amb un altre grup a la mateixa hora.
  const clashes: string[] = [];
  if (concert.status !== "cancel·lat") {
    const memberNames = new Set((band?.members || []).map((m) => m.name.toLowerCase()));
    concerts.forEach((o) => {
      if (o.id === id || o.date !== concert.date || o.time !== concert.time || o.status === "cancel·lat") return;
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
  const venueKey = normalize(concert.venue);
  const venueHistory = venueKey
    ? concerts
        .filter((c) => c.id !== id && normalize(c.venue) === venueKey && c.status !== "cancel·lat")
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 8)
        .map((c) => {
          const inv = invoices.find((i) => i.concertId === c.id) || null;
          return {
            date: c.date,
            amount: c.amount,
            invoiceState: inv?.state || null,
            daysToPay: inv && inv.state === "pagada" ? Math.max(0, daysBetween(inv.issueDate, inv.dueDate)) : null,
          };
        })
    : [];

  return (
    <ConcertDetailView
      concert={concert}
      band={band}
      bands={bands}
      invoice={invoices.find((i) => i.concertId === id) || null}
      companyInfo={companyInfo}
      clientDetails={clientDetails}
      linkedMembers={linkedMembers}
      shareLinks={shareLinks}
      backupRequests={backupRequests}
      riders={riders}
      setlists={setlists}
      riderApprovals={riderApprovals}
      checklists={checklists}
      clashes={clashes}
      venueHistory={venueHistory}
      concertExpenses={concertExpenses.reduce((s, t) => s + t.amount, 0)}
      emailReady={emailConfigured()}
      today={today()}
    />
  );
}
