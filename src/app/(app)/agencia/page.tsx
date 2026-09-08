import AgenciaView from "@/components/AgenciaView";
import { requireManager } from "@/lib/current-user";
import { db } from "@/lib/db";
import { getAgencyMembers, getAgencyInvitations } from "@/lib/agency";
import { getWorkspaceBilling, groupCap } from "@/lib/billing";
import { syncCheckoutSession } from "@/lib/stripe";
import { getContacts, getBands, getConcerts } from "@/lib/data";
import { getContactInteractions } from "@/lib/contacts-data";
import { syncAllBandPeopleToContacts } from "@/app/(app)/contactes/actions";

export const dynamic = "force-dynamic";

// Agència: pla i subscripció, qui en forma part i què pot fer cadascú,
// invitacions pendents, dades de l'agència i tots els seus grups.
export default async function AgenciaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireManager();
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] || "" : v || "");
  const billingNotice = str(sp.billing);
  const sessionId = str(sp.session_id);
  // En tornar del Checkout de Stripe, s'aplica el que s'ha comprat sense
  // esperar el webhook.
  if (billingNotice === "ok" && sessionId) {
    try { await syncCheckoutSession(profile.workspaceId, sessionId); } catch { /* el webhook ho acabarà d'aplicar */ }
  }

  // Pestanya Contactes: els músics/crew de tots els grups entren al
  // magatzem de contactes (com a /contactes).
  await syncAllBandPeopleToContacts(profile.workspaceId);
  const [members, invitations, wsRow, bandRows, billing, groups, contacts, allBands, concerts, interactions] = await Promise.all([
    getAgencyMembers(profile.workspaceId),
    getAgencyInvitations(profile.workspaceId),
    db().query("select name, logo from workspaces where id=$1", [profile.workspaceId]).then((r) => r.rows[0] || null),
    // Tots els grups de l'agència (per assignar-los i per a la graella de
    // "Grups"), sense el filtre de visibilitat.
    db().query(
      "select id, name, city, logo, logo_aspect, color1, color2, jsonb_array_length(members) as member_count from bands where workspace_id=$1 order by name",
      [profile.workspaceId]
    ).then((r) => r.rows),
    getWorkspaceBilling(profile.workspaceId),
    groupCap(profile.workspaceId),
    getContacts(profile.workspaceId),
    getBands(profile.workspaceId),
    getConcerts(profile.workspaceId),
    getContactInteractions(profile.workspaceId),
  ]);
  const concertCountByPerson: Record<string, number> = {};
  concerts.forEach((c) => {
    Object.entries(c.attendance || {}).forEach(([name, val]) => {
      if (val === "yes") concertCountByPerson[name] = (concertCountByPerson[name] || 0) + 1;
    });
  });
  return (
    <AgenciaView
      agency={{ name: wsRow?.name || "", logo: wsRow?.logo || "" }}
      me={{ clerkUserId: profile.clerkUserId, agencyOwner: profile.agencyOwner, canCreateGroups: profile.canCreateGroups }}
      members={members}
      invitations={invitations}
      bands={bandRows.map((b) => ({ id: b.id, name: b.name, city: b.city || "", logo: b.logo || "", logoAspect: b.logo_aspect || "1:1", color1: b.color1 || "", color2: b.color2 || "", memberCount: Number(b.member_count) || 0 }))}
      billing={billing}
      groups={groups}
      billingNotice={billingNotice}
      contacts={contacts}
      allBands={allBands}
      concertCountByPerson={concertCountByPerson}
      interactions={interactions}
    />
  );
}
