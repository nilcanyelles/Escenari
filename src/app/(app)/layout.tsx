import AppShell from "@/components/AppShell";
import { today, formatDateFull, capitalize } from "@/lib/format";
import { PAGES } from "@/lib/nav";
import { requireManager, hasBandMembership } from "@/lib/current-user";
import { getBands } from "@/lib/data";
import { getSelectedBandId, resolveBandScope } from "@/lib/band-scope";
import { db } from "@/lib/db";
import { IconSwap } from "@/components/RailIcons";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireManager();
  const todayLabel = capitalize(formatDateFull(today()));
  const [bands, selectedRaw, ppRow, wsRow] = await Promise.all([
    getBands(profile.workspaceId),
    getSelectedBandId(),
    db().query(
      "select photo_file_id, phone, whatsapp, role_label, contact_email from person_profiles where workspace_id=$1 and lower(person_name)=lower($2)",
      [profile.workspaceId, profile.name]
    ).then((r) => r.rows[0] || null),
    // L'agència del gestor: nom i logotip a dalt de la barra de grups.
    db().query("select name, logo from workspaces where id=$1", [profile.workspaceId]).then((r) => r.rows[0] || null),
  ]);
  // Un gestor que també toca en algun grup no té una segona àrea: ho veu tot
  // des d'aquí — només se n'indica el doble paper al seu perfil.
  const isMusician = await hasBandMembership(profile.clerkUserId);
  const roleLabel = (ppRow?.role_label || "Gestió") + (isMusician ? " · Músic" : "");
  const selectedBandId = resolveBandScope(bands, selectedRaw);
  return (
    <AppShell
      todayLabel={todayLabel}
      pages={PAGES}
      user={{
        name: profile.name,
        roleLabel,
        photoUrl: ppRow?.photo_file_id ? `/api/file/${ppRow.photo_file_id}` : "",
        phone: ppRow?.phone || "",
        whatsapp: ppRow?.whatsapp || "",
        email: ppRow?.contact_email || profile.email || "",
        editable: true,
      }}
      bands={bands.map((b) => ({ id: b.id, name: b.name, logo: b.logo || "", color1: b.color1 || "", tags: b.tags }))}
      selectedBandId={selectedBandId}
      agency={{ name: wsRow?.name || "", logo: wsRow?.logo || "" }}
      subLinks={[
        { href: "/suplents", label: "Suplències", emoji: "🔄", icon: <IconSwap /> },
      ]}
    >
      {children}
    </AppShell>
  );
}
