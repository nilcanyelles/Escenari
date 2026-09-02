import SubsBoardView from "@/components/SubsBoardView";
import { requireManager } from "@/lib/current-user";
import { getBands } from "@/lib/data";
import { getSubCandidates } from "@/lib/subs";
import { getWorkspaceBilling } from "@/lib/billing";
import { today } from "@/lib/format";

export const dynamic = "force-dynamic";

// Suplències (gestor): tots els músics d'Escenari que s'han declarat
// disponibles per fer suplències — perfil, contacte (si el volen mostrar),
// disponibilitat i alta directa com a suplent de confiança d'un grup.
// Només als plans d'Agència.
export default async function SuplentsPage() {
  const { workspaceId, agencyOwner } = await requireManager();
  const billing = await getWorkspaceBilling(workspaceId);
  const [candidates, bands] = await Promise.all([
    billing.caps.subsBoard ? getSubCandidates() : Promise.resolve([]),
    getBands(workspaceId),
  ]);
  return (
    <SubsBoardView
      candidates={candidates}
      bands={bands.map((b) => ({ id: b.id, name: b.name, backups: (b.backups || []).map((x) => x.name) }))}
      today={today()}
      billing={billing}
      canUpgrade={agencyOwner}
    />
  );
}
