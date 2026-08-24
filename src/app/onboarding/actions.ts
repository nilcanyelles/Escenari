"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

async function requireClerkUser() {
  const { userId } = await auth();
  if (!userId) throw new Error("Sessió no vàlida");
  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || "";
  return { userId, email };
}

// Sense caràcters ambigus (0/O, 1/I/L).
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function generateJoinCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
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

export type ManagerOnboardingInput = {
  managerName: string;
  groupName: string;
  logo: string; // data URL o buit
  color1: string;
  color2: string;
  invites: { email: string; name: string }[];
};

export async function completeManagerOnboardingAction(data: ManagerOnboardingInput) {
  const { userId, email } = await requireClerkUser();
  const pool = db();
  const managerName = (data.managerName || "").trim();
  const groupName = (data.groupName || "").trim();
  if (!managerName || !groupName) return { ok: false as const, error: "Cal el teu nom i el nom del grup." };
  // Un dataURL corrupte o desmesurat no ha d'entrar a la base de dades.
  const logo = data.logo && data.logo.startsWith("data:image/") && data.logo.length < 400_000 ? data.logo : "";

  const existing = (await pool.query("select role from profiles where clerk_user_id=$1", [userId])).rows[0];
  if (existing) return { ok: true as const, joinCode: "" };

  const client = await pool.connect();
  let joinCode = "";
  try {
    await client.query("begin");

    // El workspace amb les dades que ja existien abans de l'era multi-compte
    // el reclama el correu del propietari (LEGACY_OWNER_EMAIL); si la variable
    // no està definida, el primer gestor que es doni d'alta.
    const ownerEmail = (process.env.LEGACY_OWNER_EMAIL || "").trim().toLowerCase();
    const legacyTaken = (
      await client.query("select 1 from profiles where workspace_id = 'ws_legacy' limit 1")
    ).rows[0];
    const canClaimLegacy = !legacyTaken && (!ownerEmail || email.toLowerCase() === ownerEmail);
    let wsId = "ws_legacy";
    if (!canClaimLegacy) {
      wsId = "ws" + Date.now();
      await client.query("insert into workspaces (id, name) values ($1, $2)", [wsId, groupName]);
      await client.query("insert into company_info (workspace_id) values ($1)", [wsId]);
    }

    await client.query(
      `insert into profiles (clerk_user_id, email, role, name, workspace_id)
       values ($1, $2, 'manager', $3, $4)`,
      [userId, email, managerName, wsId]
    );

    const bandId = "b" + Date.now();
    for (let attempt = 0; attempt < 5; attempt++) {
      joinCode = generateJoinCode();
      const clash = (await client.query("select 1 from bands where join_code=$1", [joinCode])).rows[0];
      if (!clash) break;
    }
    await client.query(
      `insert into bands (id, name, city, rate, contact, phone, tags, members, crew, workspace_id, join_code, logo, color1, color2)
       values ($1, $2, '', 0, $3, '', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, $4, $5, $6, $7, $8)`,
      [bandId, groupName, managerName, wsId, joinCode, logo, data.color1 || "", data.color2 || ""]
    );

    for (const invite of data.invites || []) {
      const inviteEmail = (invite.email || "").trim().toLowerCase();
      if (!inviteEmail || !inviteEmail.includes("@")) continue;
      await client.query(
        `insert into invitations (id, band_id, email, name)
         values ($1, $2, $3, $4)
         on conflict (band_id, lower(email)) do nothing`,
        ["inv" + Date.now() + Math.floor(Math.random() * 10000), bandId, inviteEmail, (invite.name || "").trim()]
      );
    }

    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }

  return { ok: true as const, joinCode };
}
