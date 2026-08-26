import { notFound } from "next/navigation";
import ConcertDetailView from "@/components/ConcertDetailView";
import { getBands, getConcerts, getInvoices, getCompanyInfo, getClientDetails } from "@/lib/data";
import { getLinkedMembers } from "@/lib/group-data";
import { getBackupRequests } from "@/lib/group-data";
import { getShareLinks } from "@/lib/share-data";
import { getRiders, getSetlists, getRiderApprovals } from "@/lib/material-data";
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
  const [linkedMembers, shareLinks, backupRequests, riders, setlists, riderApprovals] = await Promise.all([
    band ? getLinkedMembers(band.id) : Promise.resolve([]),
    getShareLinks(workspaceId, id),
    getBackupRequests(workspaceId, { concertId: id }),
    band ? getRiders(band.id) : Promise.resolve([]),
    band ? getSetlists(band.id) : Promise.resolve([]),
    getRiderApprovals(workspaceId, id),
  ]);

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
      emailReady={emailConfigured()}
      today={today()}
    />
  );
}
