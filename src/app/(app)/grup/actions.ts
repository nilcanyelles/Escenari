"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireManagerAction } from "@/lib/current-user";
import { requireBandAccess } from "@/lib/band-access";
import { normalize } from "@/lib/text";
import type { MemberPerms, Vehicle } from "@/lib/types";
import { uploadFileBlob } from "@/lib/blob-storage";

export type BackupPerson = { name: string; instruments: string[]; phone: string; email: string };

// Desa la llista de suplents de confiança d'un grup.
export async function saveBandBackupsAction(bandId: string, backups: BackupPerson[]) {
  const { workspaceId } = await requireManagerAction();
  await db().query(
    "update bands set backups=$1 where id=$2 and workspace_id=$3",
    [JSON.stringify(backups || []), bandId, workspaceId]
  );
  revalidatePath("/grup");
}

// Desa la llista de vehicles del grup (tipus, color, propietari, matrícula) — es fan servir per
// triar-los ràpid a "Matrícules autoritzades" del full de ruta.
export async function saveBandVehiclesAction(bandId: string, vehicles: Vehicle[]) {
  const { workspaceId } = await requireManagerAction();
  await db().query(
    "update bands set vehicles=$1 where id=$2 and workspace_id=$3",
    [JSON.stringify(vehicles || []), bandId, workspaceId]
  );
  revalidatePath("/grup");
}

// ---------- Aparença del grup: logo, portada i colors ----------

export async function uploadBandImageAction(formData: FormData): Promise<{ ok: boolean; url?: string; error?: string }> {
  const { workspaceId } = await requireManagerAction();
  const bandId = String(formData.get("bandId") || "");
  const kind = String(formData.get("kind") || "logo"); // logo | cover
  const file = formData.get("file") as File | null;
  if (!bandId || !file) return { ok: false, error: "Falta el fitxer" };
  const owns = (await db().query("select 1 from bands where id=$1 and workspace_id=$2", [bandId, workspaceId])).rows[0];
  if (!owns) return { ok: false, error: "Grup no trobat" };
  if (!file.type.startsWith("image/")) return { ok: false, error: "Ha de ser una imatge" };
  if (file.size > 8 * 1024 * 1024) return { ok: false, error: "Màxim 8 MB" };
  const buf = Buffer.from(await file.arrayBuffer());
  const id = "fl" + Date.now() + Math.floor(Math.random() * 1000);
  const blobUrl = await uploadFileBlob("files/" + id, buf, file.type);
  await db().query(
    "insert into files (id, workspace_id, band_id, song_id, name, mime, size, data, uploaded_by, blob_url) values ($1,$2,$3,null,$4,$5,$6,null,'',$7)",
    [id, workspaceId, bandId, file.name || kind, file.type, file.size, blobUrl]
  );
  const url = `/api/file/${id}`;
  await db().query(
    kind === "cover" ? "update bands set cover_url=$1 where id=$2" : "update bands set logo=$1 where id=$2",
    [url, bandId]
  );
  revalidatePath("/grup");
  return { ok: true, url };
}

export async function saveBandAppearanceAction(bandId: string, input: { color1: string; color2: string; tags: string[] }) {
  const { workspaceId } = await requireManagerAction();
  await db().query(
    "update bands set color1=$1, color2=$2, tags=$3 where id=$4 and workspace_id=$5",
    [input.color1 || "", input.color2 || "", JSON.stringify(input.tags || []), bandId, workspaceId]
  );
  revalidatePath("/grup");
}

// ---------- Alta de membres i tècnics des de la pàgina del grup ----------

export async function addBandPersonAction(bandId: string, kind: "member" | "crew", person: { name: string; role: string; instruments: string[]; phone: string; email: string }) {
  // Gestor, o membre amb el permís "Afegir gent".
  await requireBandAccess(bandId, "members");
  const band = (await db().query("select members, crew from bands where id=$1", [bandId])).rows[0];
  if (!band) throw new Error("Grup no trobat");
  const entry = {
    name: person.name.trim(),
    role: kind === "member" ? person.instruments.join(", ") : person.role.trim(),
    instruments: kind === "member" ? person.instruments : undefined,
    phone: person.phone.trim() || undefined,
    email: person.email.trim() || undefined,
  };
  if (!entry.name) throw new Error("Falta el nom");
  const col = kind === "member" ? "members" : "crew";
  const list = (kind === "member" ? band.members : band.crew) || [];
  if (list.some((p: { name: string }) => p.name.trim().toLowerCase() === entry.name.toLowerCase())) {
    throw new Error("Ja hi ha algú amb aquest nom");
  }
  await db().query(`update bands set ${col}=$1 where id=$2`, [JSON.stringify(list.concat([entry])), bandId]);
  revalidatePath("/grup");
}

export async function removeBandPersonAction(bandId: string, kind: "member" | "crew", name: string) {
  const { workspaceId } = await requireManagerAction();
  const band = (await db().query("select members, crew from bands where id=$1 and workspace_id=$2", [bandId, workspaceId])).rows[0];
  if (!band) throw new Error("Grup no trobat");
  const col = kind === "member" ? "members" : "crew";
  const list = ((kind === "member" ? band.members : band.crew) || []).filter(
    (p: { name: string }) => p.name.trim().toLowerCase() !== name.trim().toLowerCase()
  );
  await db().query(`update bands set ${col}=$1 where id=$2`, [JSON.stringify(list), bandId]);
  revalidatePath("/grup");
}

// ---------- Permisos per membre (el gestor decideix què pot fer) ----------

// La persona pot ser tant un músic com de l'equip tècnic — es busca a
// totes dues llistes i s'actualitza la que la tingui (mai cal saber-ho
// d'entrada des d'on es truca).
export async function setMemberPermAction(bandId: string, memberName: string, key: keyof MemberPerms, on: boolean) {
  const { workspaceId } = await requireManagerAction();
  const band = (await db().query("select members, crew from bands where id=$1 and workspace_id=$2", [bandId, workspaceId])).rows[0];
  if (!band) throw new Error("Grup no trobat");
  const setPerm = (list: { name: string; perms?: Partial<MemberPerms> }[]) =>
    list.map((m) => (normalize(m.name) !== normalize(memberName) ? m : { ...m, perms: { ...(m.perms || {}), [key]: on } }));
  const members = setPerm(band.members || []);
  const crew = setPerm(band.crew || []);
  await db().query("update bands set members=$1, crew=$2 where id=$3", [JSON.stringify(members), JSON.stringify(crew), bandId]);
  revalidatePath("/grup");
}

// ---------- Invitació per reclamar un perfil creat a mà ----------
// El gestor convida un correu; quan la persona es registra i accepta,
// queda vinculada exactament a aquest membre (mateix nom → mateixa
// assistència i historial).
export async function invitePersonAction(bandId: string, memberName: string, email: string): Promise<{ ok: boolean; error?: string }> {
  const { workspaceId } = await requireManagerAction();
  const owns = (await db().query("select 1 from bands where id=$1 and workspace_id=$2", [bandId, workspaceId])).rows[0];
  if (!owns) return { ok: false, error: "Grup no trobat" };
  const cleaned = email.trim().toLowerCase();
  if (!/.+@.+\..+/.test(cleaned)) return { ok: false, error: "Correu no vàlid" };
  await db().query(
    `insert into invitations (id, band_id, email, name)
     values ($1,$2,$3,$4)
     on conflict (band_id, lower(email)) do update set name=$4, status='pendent'`,
    ["inv" + Date.now(), bandId, cleaned, memberName]
  );
  revalidatePath("/grup");
  return { ok: true };
}

// Visibilitat del caixet per als membres del grup (àrea d'artista).
export async function setShowFeesAction(bandId: string, show: boolean) {
  const { workspaceId } = await requireManagerAction();
  await db().query("update bands set show_fees=$1 where id=$2 and workspace_id=$3", [show, bandId, workspaceId]);
  revalidatePath("/grup");
  revalidatePath("/artista");
}

// Percentatges de repartiment del caixet predeterminats del grup (nom -> %):
// es fan servir per omplir el repartiment dels concerts que encara no en
// tinguin cap de desat.
export async function saveDefaultPayoutSplitAction(bandId: string, split: Record<string, number>) {
  const { workspaceId } = await requireManagerAction();
  await db().query(
    "update bands set default_payout_split=$1 where id=$2 and workspace_id=$3",
    [JSON.stringify(split || {}), bandId, workspaceId]
  );
  revalidatePath("/concerts");
  revalidatePath("/grup");
}

// Desa una secció del full de ruta com a plantilla predeterminada del grup
// (només les seves "opcions" — etiquetes/fases/càrrecs i interruptors — mai
// detalls ni enllaços concrets, que ja s'han retallat abans de cridar això).
// Es fusiona amb la resta de seccions ja desades sense tocar-les.
export async function saveDefaultRouteSheetSectionAction(bandId: string, section: string, items: unknown[]) {
  const { workspaceId } = await requireManagerAction();
  const { rows } = await db().query<{ default_route_sheet: Record<string, unknown> | null }>(
    "select default_route_sheet from bands where id=$1 and workspace_id=$2",
    [bandId, workspaceId]
  );
  const current = (rows[0]?.default_route_sheet as Record<string, unknown> | null) || {};
  const next = { ...current, [section]: items };
  await db().query(
    "update bands set default_route_sheet=$1 where id=$2 and workspace_id=$3",
    [JSON.stringify(next), bandId, workspaceId]
  );
  revalidatePath("/concerts");
  revalidatePath("/grup");
}

// Publica una cerca de suplent per a un concert (visible a la borsa de músics).
export async function publishBackupRequestAction(input: {
  bandId: string;
  concertId: string;
  memberName: string;
  instruments: string[];
  note: string;
}) {
  const { workspaceId } = await requireManagerAction();
  const id = "br" + Date.now();
  await db().query(
    `insert into backup_requests (id, workspace_id, band_id, concert_id, member_name, instruments, note)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [id, workspaceId, input.bandId, input.concertId, input.memberName, JSON.stringify(input.instruments || []), input.note || ""]
  );
  revalidatePath("/grup");
  revalidatePath("/suplencies");
  return id;
}

export async function setBackupRequestStatusAction(id: string, status: "oberta" | "coberta" | "cancel·lada") {
  const { workspaceId } = await requireManagerAction();
  await db().query(
    "update backup_requests set status=$1 where id=$2 and workspace_id=$3",
    [status, id, workspaceId]
  );
  revalidatePath("/grup");
  revalidatePath("/suplencies");
}

export async function respondBackupApplicationAction(requestId: string, clerkUserId: string, status: "acceptada" | "rebutjada") {
  const { workspaceId } = await requireManagerAction();
  const owns = await db().query("select 1 from backup_requests where id=$1 and workspace_id=$2", [requestId, workspaceId]);
  if (!owns.rows.length) throw new Error("Cerca no trobada");
  await db().query(
    "update backup_applications set status=$1 where request_id=$2 and clerk_user_id=$3",
    [status, requestId, clerkUserId]
  );
  if (status === "acceptada") {
    await db().query("update backup_requests set status='coberta' where id=$1", [requestId]);
  }
  revalidatePath("/grup");
  revalidatePath("/suplencies");
}
