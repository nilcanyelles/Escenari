import { db } from "./db";
import type { Band, Concert, Invoice, CompanyInfo, ClientDetails, Contact } from "./types";

function toDateStr(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export async function getBands(workspaceId: string): Promise<Band[]> {
  const { rows } = await db().query("select * from bands where workspace_id=$1 order by name", [workspaceId]);
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
    joinCode: r.join_code,
    joinCodeActive: r.join_code_active,
    logo: r.logo,
    color1: r.color1,
    color2: r.color2,
    backups: r.backups || [],
    showFees: !!r.show_fees,
  }));
}

export async function getConcerts(workspaceId: string): Promise<Concert[]> {
  const { rows } = await db().query("select * from concerts where workspace_id=$1 order by date desc", [workspaceId]);
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
    payouts: r.payouts || {},
    riderId: r.rider_id || null,
    setlistId: r.setlist_id || null,
    kind: r.kind || "bolo",
  }));
}

export async function getClientDetails(workspaceId: string): Promise<Record<string, ClientDetails>> {
  const { rows } = await db().query(
    "select client_name, cif, nom, address from client_details where workspace_id=$1",
    [workspaceId]
  );
  const map: Record<string, ClientDetails> = {};
  rows.forEach((r) => { map[r.client_name] = { clientName: r.client_name, cif: r.cif, nom: r.nom, address: r.address }; });
  return map;
}

export async function getCompanyInfo(workspaceId: string): Promise<CompanyInfo> {
  const { rows } = await db().query(
    "select nom, cif, address, iban, iva_rate, irpf_rate from company_info where workspace_id=$1",
    [workspaceId]
  );
  const r = rows[0];
  if (!r) return { nom: "Escenari", cif: "", address: "", iban: "", ivaRate: 21, irpfRate: 0 };
  return { nom: r.nom, cif: r.cif, address: r.address, iban: r.iban, ivaRate: Number(r.iva_rate) || 21, irpfRate: Number(r.irpf_rate) || 0 };
}

export async function getContacts(workspaceId: string): Promise<Contact[]> {
  const { rows } = await db().query("select * from contacts where workspace_id=$1 order by name", [workspaceId]);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    kinds: r.kinds,
    role: r.role,
    phone: r.phone,
    email: r.email,
    company: r.company,
    cif: r.cif,
    address: r.address,
    iban: r.iban,
    notes: r.notes,
  }));
}

export async function getInvoices(workspaceId: string): Promise<Invoice[]> {
  const { rows } = await db().query("select * from invoices where workspace_id=$1 order by issue_date desc", [workspaceId]);
  return rows.map((r) => ({
    id: r.id,
    concertId: r.concert_id,
    client: r.client,
    bandName: r.band_name,
    issueDate: toDateStr(r.issue_date),
    dueDate: toDateStr(r.due_date),
    amount: r.amount,
    state: r.state,
    baseAmount: r.base_amount || Math.round(r.amount / 1.21),
    ivaRate: Number(r.iva_rate) || 21,
    irpfRate: Number(r.irpf_rate) || 0,
    depositAmount: r.deposit_amount || 0,
    depositPaid: !!r.deposit_paid,
    hash: r.hash || "",
  }));
}
