"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { uploadFileBlob } from "@/lib/blob-storage";
import { getOrCreatePersonProfile } from "@/lib/person-profile";
import { createAgencyInvitations } from "@/lib/agency";

async function requireClerkUser() {
  const { userId } = await auth();
  if (!userId) throw new Error("Sessió no vàlida");
  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || "";
  return { userId, email };
}

export async function completeArtistOnboardingAction(data: { name: string; instruments: string[] }) {
  const { userId, email } = await requireClerkUser();
  const pool = db();
  const name = (data.name || "").trim();
  if (!name) return { ok: false as const, error: "Cal un nom." };
  const instruments = (data.instruments || []).map((i) => i.trim()).filter(Boolean);

  await pool.query(
    `insert into profiles (clerk_user_id, email, role, name, instruments)
     values ($1, $2, 'artist', $3, $4)
     on conflict (clerk_user_id) do nothing`,
    [userId, email, name, JSON.stringify(instruments)]
  );
  return { ok: true as const };
}

// Un dataURL corrupte o desmesurat no ha d'entrar a la base de dades.
function safeDataUrl(v: string | undefined): string {
  return v && v.startsWith("data:image/") && v.length < 400_000 ? v : "";
}

// Guarda una imatge (data URL) com a fitxer del workspace i en torna l'id.
async function storeDataUrlFile(workspaceId: string, dataUrl: string, name: string, uploadedBy: string): Promise<string | null> {
  const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  const mime = m[1];
  const buf = Buffer.from(m[2], "base64");
  const id = "fl" + Date.now() + Math.floor(Math.random() * 1000);
  const blobUrl = await uploadFileBlob("files/" + id, buf, mime);
  await db().query(
    "insert into files (id, workspace_id, band_id, song_id, name, mime, size, data, uploaded_by, blob_url) values ($1,$2,null,null,$3,$4,$5,null,$6,$7)",
    [id, workspaceId, name, mime, buf.length, uploadedBy, blobUrl]
  );
  return id;
}

export type AgencyOnboardingInput = {
  agencyName: string;
  agencyLogo?: string;   // data URL o buit
  managerName: string;
  managerPhoto?: string; // data URL o buit
  managerRole: string;
  invites: { name: string; role: string; email: string }[];
};

export type AgencyOnboardingResult =
  | { ok: true; invites: { name: string; email: string; url: string }[] }
  | { ok: false; error: string };

// Alta d'una agència: el workspace (nom i logotip), el primer gestor (que hi
// mana) amb la seva foto i càrrec, i les invitacions a la resta de l'equip.
// Els grups es creen després, des de Configuració.
export async function completeAgencyOnboardingAction(data: AgencyOnboardingInput): Promise<AgencyOnboardingResult> {
  const { userId, email } = await requireClerkUser();
  const pool = db();
  const managerName = (data.managerName || "").trim();
  const agencyName = (data.agencyName || "").trim();
  const managerRole = (data.managerRole || "").trim() || "Mànager";
  if (!managerName || !agencyName) return { ok: false, error: "Cal el nom de l'agència i el teu nom." };
  const agencyLogo = safeDataUrl(data.agencyLogo);
  const managerPhoto = safeDataUrl(data.managerPhoto);

  const existing = (await pool.query("select role from profiles where clerk_user_id=$1", [userId])).rows[0];
  if (existing) return { ok: true, invites: [] };

  const client = await pool.connect();
  let wsId = "ws_legacy";
  try {
    await client.query("begin");

    // El workspace amb les dades que ja existien abans de l'era multi-compte
    // és compartit: qualsevol correu de la llista LEGACY_OWNER_EMAIL (separats
    // per comes) que es doni d'alta com a gestor hi entra com a co-gestor. Si
    // la variable no està definida, el reclama el primer gestor que arribi.
    const ownerEmails = (process.env.LEGACY_OWNER_EMAIL || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const legacyTaken = (
      await client.query("select 1 from profiles where workspace_id = 'ws_legacy' limit 1")
    ).rows[0];
    const joinsLegacy = ownerEmails.length
      ? ownerEmails.includes(email.toLowerCase())
      : !legacyTaken;
    if (!joinsLegacy) {
      wsId = "ws" + Date.now();
      await client.query("insert into workspaces (id, name, logo) values ($1, $2, $3)", [wsId, agencyName, agencyLogo]);
      await client.query("insert into company_info (workspace_id) values ($1)", [wsId]);
    } else {
      // El workspace compartit només agafa el nom/logo si encara té els de
      // sèrie (un co-gestor que arriba després no trepitja els que ja hi ha).
      await client.query(
        `update workspaces set
           name = case when name in ('', 'Escenari') then $1 else name end,
           logo = case when logo = '' then $2 else logo end
         where id = 'ws_legacy'`,
        [agencyName, agencyLogo]
      );
    }

    await client.query(
      `insert into profiles (clerk_user_id, email, role, name, workspace_id, agency_role, agency_owner, can_create_groups, view_all_groups)
       values ($1, $2, 'manager', $3, $4, $5, true, true, true)`,
      [userId, email, managerName, wsId, managerRole]
    );

    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }

  // Perfil de persona del gestor (foto i càrrec), com a Edita el perfil.
  const token = await getOrCreatePersonProfile(wsId, managerName);
  await pool.query(
    "update person_profiles set clerk_user_id=$1, role_label=$2 where id=$3",
    [userId, managerRole, token]
  );
  if (managerPhoto) {
    const fileId = await storeDataUrlFile(wsId, managerPhoto, "foto", managerName).catch(() => null);
    if (fileId) await pool.query("update person_profiles set photo_file_id=$1 where id=$2", [fileId, token]);
  }

  const invites = await createAgencyInvitations(wsId, managerName, data.invites || []);
  return { ok: true, invites };
}
