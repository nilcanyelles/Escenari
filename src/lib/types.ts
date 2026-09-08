// removeMembers: pot treure gent del grup (o passar-la a suplents);
// perms: veu la pestanya Permisos i pot canviar els dels altres;
// admin: ho pot tot (vegeu memberPerms a perms.ts).
export type MemberPerms = {
  songs: boolean; riders: boolean; setlists: boolean; members: boolean; events: boolean;
  removeMembers: boolean; perms: boolean; admin: boolean;
};

export type Person = { name: string; role: string; phone?: string; whatsapp?: string; email?: string; instruments?: string[]; perms?: Partial<MemberPerms> };

export type BackupPerson = { name: string; instruments: string[]; phone: string; email: string; role?: string };

export type Vehicle = { type: string; brand: string; color: string; owner: string; plate: string };

export type SocialLinks = { instagram?: string; youtube?: string; tiktok?: string; spotify?: string };

export type SocialPlatform = "instagram" | "tiktok" | "spotify" | "youtube";

// De quines xarxes es fa seguiment (surten a Inici, a la pàgina pública i
// als gràfics d'evolució). Sense valor explícit: les que tinguin enllaç.
export type SocialTracking = Partial<Record<SocialPlatform, boolean>>;

export type SocialStats = {
  // Instagram i TikTok: llegits de la pàgina/perfil públic, o a mà.
  instagramFollowers?: number;
  tiktokFollowers?: number;
  // Spotify no dona seguidors sense sessió iniciada (es carreguen amb
  // JavaScript, mai al codi de la pàgina) — només els oients mensuals, que
  // sí que hi surten (millor esforç) o s'escriuen a mà.
  spotifyMonthlyListeners?: number;
  // Subscriptors i visites totals del canal de YouTube, llegits de la
  // pàgina pública del canal.
  youtubeSubscribers?: number;
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
  // Proporció del logo (clau de LOGO_ASPECTS: "1:1", "4:3", "16:9", "3:1")
  // i punt focal de la portada (background-position, p. ex. "50% 30%") —
  // triats a "Edita el grup".
  logoAspect?: string;
  coverPos?: string;
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
  socialTracking?: SocialTracking;
  // Pàgina pública del grup (/g/token): enllaç compartible i text de
  // presentació que s'hi mostra.
  publicToken?: string;
  bio?: string;
  // Any en actiu, editable a mà des de la pàgina pública — buit = es
  // calcula sol a partir del primer concert.
  activeSince?: string;
};

// Contracte d'actuació d'un concert: text de les clàusules (paràgrafs
// separats per línies en blanc), notes extra i qui signa per l'artista.
export type ContractData = {
  clauses: string;
  extra: string;
  signerName: string;
  signerRole: string;
  updatedAt?: string;
};

export type Concert = {
  id: string;
  date: string;
  time: string;
  // Hora exacta (HH:MM), diferent de "time" (tram aproximat del dia) —
  // opcional; si és buida, no compta al percentatge d'Informació general.
  exactTime: string;
  venue: string;
  city: string;
  // Carrer, número i població del recinte — s'empleix sol en triar un
  // recinte a la cerca; Població ja no és un camp propi de la UI.
  address: string;
  festaEntitat: string;
  bandId: string;
  bandName: string;
  tags: string[];
  status: "confirmat" | "pendent" | "reservat" | "cancel·lat";
  amount: number;
  attendance: Record<string, "yes" | "no">;
  substitutes: Record<string, string>;
  noSubstitute: Record<string, boolean>;
  // Membres exclosos de la convocatòria d'aquest concert (name -> true):
  // no s'eliminen del grup, es desactiven només per a aquest bolo.
  convocatoriaExcluded: Record<string, boolean>;
  // Contacte principal d'aquest concert (organitzador/promotor) — a la
  // pestanya "Informació general", diferent dels contactes del full de ruta.
  contact: { email: string; name: string; phone: string; company: string };
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
  // Cançons destacades de la setlist assignada, per a aquest concert en
  // concret (clau = títol de la cançó) — mateixa setlist, assaigs diferents,
  // cada un amb les seves pròpies destacades.
  setlistHighlights?: Record<string, boolean>;
  // Si encara no es pot fer públic (xarxes, cartell...) i, si no, a partir
  // de quina data ja s'hi podrà — "Informació general", al costat del tipus.
  // "" = encara sense decidir (mai pre-sel·leccionat per defecte).
  canAnnounce: "yes" | "no" | "";
  announceAfter: string;
  // Si l'entrada al concert és gratuïta o de pagament — "Informació
  // general", al costat de "Es pot anunciar?". "" = encara sense decidir.
  ticketType: "gratuit" | "pagament" | "";
  invited?: string[];
  attToken?: string;
  // Contracte d'actuació: clàusules editables i enllaç públic per enviar-lo.
  contract?: ContractData | null;
  contractToken?: string;
};

// El contacte ve d'una columna jsonb que pot faltar o tenir només algunes
// claus (concerts antics, migració nova) — sempre torna les 4 fetes.
export function normalizeContact(c: unknown): Concert["contact"] {
  const o = (c && typeof c === "object" ? c : {}) as Partial<Concert["contact"]>;
  return { email: o.email || "", name: o.name || "", phone: o.phone || "", company: o.company || "" };
}

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
