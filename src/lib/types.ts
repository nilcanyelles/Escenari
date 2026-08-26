export type Person = { name: string; role: string; phone?: string; whatsapp?: string; email?: string; instruments?: string[] };

export type BackupPerson = { name: string; instruments: string[]; phone: string; email: string };

export type Band = {
  id: string;
  name: string;
  city: string;
  rate: number;
  contact: string;
  phone: string;
  tags: string[];
  members: Person[];
  crew: Person[];
  joinCode?: string;
  joinCodeActive?: boolean;
  logo?: string;
  color1?: string;
  color2?: string;
  backups?: BackupPerson[];
  showFees?: boolean;
  coverUrl?: string;
};

export type Concert = {
  id: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  festaEntitat: string;
  bandId: string;
  bandName: string;
  tags: string[];
  status: "confirmat" | "pendent" | "reservat" | "cancel·lat";
  amount: number;
  attendance: Record<string, "yes" | "no">;
  substitutes: Record<string, string>;
  noSubstitute: Record<string, boolean>;
  routeSheet: unknown;
  payouts?: Record<string, number>;
  riderId?: string | null;
  setlistId?: string | null;
  kind?: "bolo" | "assaig" | "reunio" | "altre";
  invited?: string[];
};

export type Invoice = {
  id: string;
  concertId: string;
  client: string;
  bandName: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  state: "pagada" | "pendent" | "vençuda";
  baseAmount: number;
  ivaRate: number;
  irpfRate: number;
  depositAmount: number;
  depositPaid: boolean;
  hash: string;
};

export type ClientDetails = {
  clientName: string;
  cif: string;
  nom: string;
  address: string;
};

export type CompanyInfo = {
  nom: string;
  cif: string;
  address: string;
  iban: string;
  ivaRate: number;
  irpfRate: number;
};

export type ContactKind = "grup" | "ruta" | "empresa";

export type Contact = {
  id: string;
  name: string;
  kinds: ContactKind[];
  role: string;
  phone: string;
  email: string;
  company: string;
  cif: string;
  address: string;
  iban: string;
  notes: string;
};
