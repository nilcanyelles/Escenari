export type Person = { name: string; role: string; phone?: string; email?: string; instruments?: string[] };

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
  status: "confirmat" | "pendent" | "cancel·lat";
  amount: number;
  attendance: Record<string, "yes" | "no">;
  substitutes: Record<string, string>;
  noSubstitute: Record<string, boolean>;
  routeSheet: unknown;
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
