import AgendaView from "@/components/AgendaView";
import { getBands, getConcerts, getInvoices } from "@/lib/data";
import { db } from "@/lib/db";
import { today } from "@/lib/format";
import { requireManager } from "@/lib/current-user";
import { getSelectedBandId, resolveBandScope, scopeConcerts, scopeInvoices } from "@/lib/band-scope";

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const { workspaceId } = await requireManager();
  const [bands, concerts, invoices, selectedRaw] = await Promise.all([
    getBands(workspaceId), getConcerts(workspaceId), getInvoices(workspaceId), getSelectedBandId(),
  ]);
  const bandId = resolveBandScope(bands, selectedRaw);
  const scoped = scopeConcerts(concerts, bandId);
  const icsToken = (await db().query("select ics_token from workspaces where id=$1", [workspaceId])).rows[0]?.ics_token || "";
  return (
    <AgendaView
      bands={bandId ? bands.filter((b) => b.id === bandId) : bands}
      concerts={scoped}
      invoices={scopeInvoices(invoices, concerts, bandId)}
      icsToken={icsToken}
      selectedBandId={bandId}
      today={today()}
    />
  );
}
