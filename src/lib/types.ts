export type MemberPerms = { songs: boolean; riders: boolean; setlists: boolean; members: boolean; events: boolean };

export type Person = { name: string; role: string; phone?: string; whatsapp?: string; email?: string; instruments?: string[]; perms?: Partial<MemberPerms> };

export type BackupPerson = { name: string; instruments: string[]; phone: string; email: string };

export type Vehicle = { type: string; brand: string; color: string; owner: string; plate: string };

export type SocialLinks = { instagram?: string; youtube?: string; tiktok?: string; spotify?: string };

export type SocialStats = {
  instagramFollowers?: number;
  // Seguidors de Spotify: es pot llegir automàticament de l'API pública.
  spotifyFollowers?: number;
  // Oients mensuals: només ho veu el mateix grup a Spotify for Artists —
  // l'API pública no ho dona a ningú, sempre és manual.
  spotifyMonthlyListeners?: number;
  tiktokFollowers?: number;
  // Visites totals del canal de YouTube: es pot llegir automàticament.
  youtubeViews?: number;
};

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
  // Percentatges de repartiment del caixet predeterminats (nom -> %),
  // aplicats als concerts que encara no tinguin cap repartiment desat.
  defaultPayoutSplit?: Record<string, number>;
  vehicles?: Vehicle[];
  // Plantilla d'"opcions" del full de ruta (etiquetes/fases/càrrecs i
  // interruptors, mai detalls ni enllaços) que s'aplica als concerts nous
  // d'aquest grup en comptes de la plantilla genèrica.
  defaultRouteSheet?: import("./route-sheet").RouteSheetDefaults;
  socialLinks?: SocialLinks;
  socialStats?: SocialStats;
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
  // Si l'agència assumeix les despeses del bolo (el seu % es calcula sobre
  // el caixet net) o no (sobre el brut, i les despeses les absorbeix només
  // la resta del repartiment). Per defecte true.
  agencyAssumesExpenses?: boolean;
  // Percentatge fix de la comissió de l'agència — es manté fix encara que
  // canviïn les despeses o el caixet (només varia l'import en € derivat).
  agencyPct?: number;
  // Horaris que es mostren al pòster del concert (l'oficial + els que
  // s'hagin afegit per altres actuacions el mateix dia), editables des del
  // modal del pòster.
  posterSchedule?: { time: string; label: string; isOwn?: boolean }[];
  riderId?: string | null;
  setlistId?: string | null;
  kind?: "bolo" | "assaig" | "reunio" | "altre";
  invited?: string[];
  attToken?: string;
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
