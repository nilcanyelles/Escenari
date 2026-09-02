import { randomBytes } from "node:crypto";
import { db } from "./db";
import { bandInviteUrl } from "./agency";
import { sendEmail, emailConfigured } from "./email";
import { getOrCreatePersonProfile } from "./person-profile";
import type { Person } from "./types";

// Alta d'un grup amb el seu equip, compartida entre l'agència (Configuració)
// i el músic que crea el seu propi grup: el grup, els músics i l'equip
// tècnic ja a dins, una invitació amb enllaç per a cada persona i, si
// escau, qui el crea també com a músic del grup.

export type CreateGroupPerson = {
  name: string;
  kind: "musician" | "crew";
  instruments: string[];
  role: string;
  email: string;
};

export type CreateGroupInput = {
  name: string;
  logo: string; // data URL o buit
  color1: string;
  color2: string;
  tags: string[];
  city: string;
  people: CreateGroupPerson[];
};

export type CreateGroupResult = {
  bandId: string;
  invites: { name: string; email: string; url: string; asCrew: boolean }[];
};

export type SelfMember = { clerkUserId: string; name: string; email: string; instruments: string[] };

// Sense caràcters ambigus (0/O, 1/I/L).
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function generateJoinCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

export async function createBandWithPeople(opts: {
  workspaceId: string;
  creatorName: string;
  input: CreateGroupInput;
  self?: SelfMember | null;
}): Promise<CreateGroupResult & { members: Person[]; crew: Person[] }> {
  const { workspaceId, creatorName, input, self } = opts;
  const pool = db();
  const name = (input.name || "").trim();
  if (!name) throw new Error("Cal el nom del grup");
  const logo = input.logo && input.logo.startsWith("data:image/") && input.logo.length < 400_000 ? input.logo : "";

  const people = (input.people || []).map((x) => ({
    name: (x.name || "").trim(),
    kind: x.kind === "crew" ? "crew" : "musician",
    instruments: (x.instruments || []).map((i) => i.trim()).filter(Boolean),
    role: (x.role || "").trim(),
    email: (x.email || "").trim().toLowerCase(),
  })).filter((x) => x.name && !(self && x.name.toLowerCase() === self.name.trim().toLowerCase()));

  const members: Person[] = [];
  if (self) {
    members.push({ name: self.name.trim(), role: self.instruments.join(", "), instruments: self.instruments, email: self.email || undefined });
  }
  people.filter((x) => x.kind === "musician").forEach((x) => {
    members.push({ name: x.name, role: x.instruments.join(", "), instruments: x.instruments, email: x.email || undefined });
  });
  const crew: Person[] = people.filter((x) => x.kind === "crew").map((x) => ({
    name: x.name, role: x.role || "Crew", email: x.email || undefined,
  }));

  const bandId = "b" + Date.now();
  let joinCode = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    joinCode = generateJoinCode();
    const clash = (await pool.query("select 1 from bands where join_code=$1", [joinCode])).rows[0];
    if (!clash) break;
  }
  await pool.query(
    `insert into bands (id, name, city, rate, contact, phone, tags, members, crew, workspace_id, join_code, join_code_active, logo, color1, color2)
     values ($1, $2, $3, 0, $4, '', $5, $6, $7, $8, $9, true, $10, $11, $12)`,
    [bandId, name, (input.city || "").trim(), creatorName, JSON.stringify((input.tags || []).map((t) => t.trim()).filter(Boolean)),
      JSON.stringify(members), JSON.stringify(crew), workspaceId, joinCode, logo, input.color1 || "", input.color2 || ""]
  );

  // Qui crea el grup i hi toca: vinculat al seu membre des del primer moment.
  if (self) {
    await pool.query(
      `insert into band_members (band_id, clerk_user_id, member_name) values ($1, $2, $3)
       on conflict (band_id, clerk_user_id) do update set member_name = excluded.member_name`,
      [bandId, self.clerkUserId, self.name.trim()]
    );
    const token = await getOrCreatePersonProfile(workspaceId, self.name.trim());
    await pool.query("update person_profiles set clerk_user_id=$1 where id=$2 and clerk_user_id is null", [self.clerkUserId, token]);
  }

  const invites: CreateGroupResult["invites"] = [];
  for (const person of people) {
    const token = "i_" + randomBytes(9).toString("base64url");
    await pool.query(
      `insert into invitations (id, band_id, email, name, token, as_crew, role_label)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (band_id, lower(email)) where email <> '' do update set name=excluded.name, token=excluded.token, as_crew=excluded.as_crew, role_label=excluded.role_label, status='pendent'`,
      ["inv" + Date.now() + Math.floor(Math.random() * 100000), bandId, person.email, person.name, token, person.kind === "crew", person.role]
    );
    const url = bandInviteUrl(token);
    if (person.email.includes("@") && emailConfigured()) {
      await sendEmail({
        to: person.email,
        subject: `${name}: reclama el teu perfil a Escenari`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #12101f; color: #f5f4fa; padding: 32px; border-radius: 16px;">
            <div style="letter-spacing: 4px; font-size: 13px; color: #a99df5; margin-bottom: 24px;">ESCENARI</div>
            <h2 style="margin: 0 0 8px; font-size: 20px;">${name}</h2>
            <p style="color: #d9d6e8; line-height: 1.5;">Hola ${person.name},<br/><br/>${creatorName || "El gestor"} t'ha afegit a ${name}. Entra amb aquest enllaç per reclamar el teu perfil i veure els bolos, confirmar assistència i tenir el repertori a mà.</p>
            <a href="${url}" style="display: inline-block; background: #8b7bff; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: bold; margin: 16px 0;">Reclama el meu perfil</a>
          </div>`,
      }).catch(() => { /* l'enllaç es pot passar a mà */ });
    }
    invites.push({ name: person.name, email: person.email, url, asCrew: person.kind === "crew" });
  }

  return { bandId, invites, members, crew };
}
