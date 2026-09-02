import AgencySettingsView from "@/components/AgencySettingsView";
import { requireManager } from "@/lib/current-user";
import { db } from "@/lib/db";
import { getAgencyMembers, getAgencyInvitations } from "@/lib/agency";

export const dynamic = "force-dynamic";

// Configuració de l'agència: qui en forma part i què pot fer cadascú,
// invitacions pendents i alta de grups nous.
export default async function ConfiguracioPage() {
  const profile = await requireManager();
  const [members, invitations, wsRow, bandRows] = await Promise.all([
    getAgencyMembers(profile.workspaceId),
    getAgencyInvitations(profile.workspaceId),
    db().query("select name, logo from workspaces where id=$1", [profile.workspaceId]).then((r) => r.rows[0] || null),
    // Tots els grups de l'agència (per assignar-los), sense el filtre de visibilitat.
    db().query("select id, name, logo, color1 from bands where workspace_id=$1 order by name", [profile.workspaceId]).then((r) => r.rows),
  ]);
  return (
    <AgencySettingsView
      agency={{ name: wsRow?.name || "", logo: wsRow?.logo || "" }}
      me={{ clerkUserId: profile.clerkUserId, agencyOwner: profile.agencyOwner, canCreateGroups: profile.canCreateGroups }}
      members={members}
      invitations={invitations}
      bands={bandRows.map((b) => ({ id: b.id, name: b.name, logo: b.logo || "", color1: b.color1 || "" }))}
    />
  );
}
