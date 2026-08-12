import { db } from "./db";
import type { Band, Concert, Invoice, CompanyInfo, ClientDetails } from "./types";

function toDateStr(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export async function getBands(): Promise<Band[]> {
  const { rows } = await db().query("select * from bands order by name");
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    city: r.city,
    rate: r.rate,
    contact: r.contact,
    phone: r.phone,
    tags: r.tags,
    members: r.members,
    crew: r.crew,
  }));
}

export async function getConcerts(): Promise<Concert[]> {
  const { rows } = await db().query("select * from concerts order by date desc");
  return rows.map((r) => ({
    id: r.id,
    date: toDateStr(r.date),
    time: r.time,
    venue: r.venue,
    city: r.city,
    festaEntitat: r.festa_entitat,
    bandId: r.band_id,
    bandName: r.band_name,
    tags: r.tags,
    status: r.status,
    amount: r.amount,
    attendance: r.attendance,
    substitutes: r.substitutes,
    noSubstitute: r.no_substitute,
    routeSheet: r.route_sheet,
  }));
}

export async function getClientDetails(): Promise<Record<string, ClientDetails>> {
  const { rows } = await db().query("select client_name, cif, nom, address from client_details");
  const map: Record<string, ClientDetails> = {};
  rows.forEach((r) => { map[r.client_name] = { clientName: r.client_name, cif: r.cif, nom: r.nom, address: r.address }; });
  return map;
}

export async function getCompanyInfo(): Promise<CompanyInfo> {
  const { rows } = await db().query("select nom, cif, address, iban from company_info where id = 1");
  return rows[0] || { nom: "La Bona Party", cif: "", address: "", iban: "" };
}

export async function getInvoices(): Promise<Invoice[]> {
  const { rows } = await db().query("select * from invoices order by issue_date desc");
  return rows.map((r) => ({
    id: r.id,
    concertId: r.concert_id,
    client: r.client,
    bandName: r.band_name,
    issueDate: toDateStr(r.issue_date),
    dueDate: toDateStr(r.due_date),
    amount: r.amount,
    state: r.state,
  }));
}
