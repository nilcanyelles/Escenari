"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { uploadFileBlob } from "@/lib/blob-storage";
import { getOrCreatePersonProfile } from "@/lib/person-profile";
import { createAgencyInvitations } from "@/lib/agency";
import { slugifyUsername, isValidUsername, baseUsernameSuggestions, digitSuffixVariants } from "@/lib/username";

async function requireClerkUser() {
  const { userId } = await auth();
  if (!userId) throw new Error("Sessió no vàlida");
  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || "";
  return { userId, email };
}

async function isUsernameTaken(pool: ReturnType<typeof db>, username: string): Promise<boolean> {
  const r = await pool.query("select 1 from profiles where lower(username)=lower($1) limit 1", [username]);
  return !!r.rows[0];
}

// Dels candidats (en ordre de preferència), els primers "limit" que encara
// no té ningú — una sola consulta per a tots alhora.
async function firstAvailable(pool: ReturnType<typeof db>, candidates: Iterable<string>, limit: number): Promise<string[]> {
  const list = Array.from(candidates);
  if (list.length === 0) return [];
  const rows = (
    await pool.query("select lower(username) as u from profiles where lower(username) = any($1::text[])", [list.map((c) => c.toLowerCase())])
  ).rows as { u: string }[];
  const taken = new Set(rows.map((r) => r.u));
  const out: string[] = [];
  for (const c of list) {
    if (!taken.has(c.toLowerCase())) out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}

export type UsernameCheckResult = {
  normalized: string;
  valid: boolean;
  available: boolean;
  suggestions: string[];
};

// Comprovació en viu mentre s'escriu el nom d'usuari (@...), vegeu
// UsernameField a OnboardingFlow. Amb el camp buit, torna suggeriments a
// partir del nom i cognoms; si el triat ja existeix, en torna variants amb
// un sufix numèric.
export async function checkUsernameAction(raw: string, fullName: string): Promise<UsernameCheckResult> {
  const normalized = slugifyUsername(raw);
  const pool = db();
  if (!normalized) {
    const suggestions = await firstAvailable(pool, baseUsernameSuggestions(fullName), 3);
    return { normalized, valid: false, available: false, suggestions };
  }
  if (!isValidUsername(normalized)) {
    return { normalized, valid: false, available: false, suggestions: [] };
  }
  const taken = await isUsernameTaken(pool, normalized);
  if (!taken) return { normalized, valid: true, available: true, suggestions: [] };
  const suggestions = await firstAvailable(pool, digitSuffixVariants(normalized), 3);
  return { normalized, valid: true, available: false, suggestions };
}

export async function completeArtistOnboardingAction(data: { name: string; instruments: string[]; username: string }) {
  const { userId, email } = await requireClerkUser();
  const pool = db();
  const name = (data.name || "").trim();
  if (!name) return { ok: false as const, error: "Cal un nom." };
  const username = slugifyUsername(data.username || "");
  if (!isValidUsername(username)) return { ok: false as const, error: "Tria un nom d'usuari vàlid." };
  if (await isUsernameTaken(pool, username)) return { ok: false as const, error: "Aquest nom d'usuari ja no està disponible." };
  const instruments = (data.instruments || []).map((i) => i.trim()).filter(Boolean);

  await pool.query(
    `insert into profiles (clerk_user_id, email, role, name, username, instruments)
     values ($1, $2, 'artist', $3, $4, $5)
     on conflict (clerk_user_id) do nothing`,
    [userId, email, name, username, JSON.stringify(instruments)]
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
  managerUsername: string;
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
  const managerUsername = slugifyUsername(data.managerUsername || "");
  if (!isValidUsername(managerUsername)) return { ok: false, error: "Tria un nom d'usuari vàlid." };
  const agencyLogo = safeDataUrl(data.agencyLogo);
  const managerPhoto = safeDataUrl(data.managerPhoto);

  const existing = (await pool.query("select role from profiles where clerk_user_id=$1", [userId])).rows[0];
  if (existing) return { ok: true, invites: [] };
  if (await isUsernameTaken(pool, managerUsername)) return { ok: false, error: "Aquest nom d'usuari ja no està disponible." };

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
      // 14 dies de prova amb tot inclòs, sense targeta.
      await client.query(
        "insert into workspaces (id, name, logo, trial_ends_at) values ($1, $2, $3, now() + interval '14 days')",
        [wsId, agencyName, agencyLogo]
      );
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
      `insert into profiles (clerk_user_id, email, role, name, username, workspace_id, agency_role, agency_owner, can_create_groups, view_all_groups)
       values ($1, $2, 'manager', $3, $4, $5, $6, true, true, true)`,
      [userId, email, managerName, managerUsername, wsId, managerRole]
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
