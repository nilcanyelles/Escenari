// Plans d'Escenari (definició compartida entre servidor i client): què
// inclou cadascun, els límits i els preus que es mostren. El cobrament real
// el fa Stripe (vegeu lib/stripe.ts); aquí només hi ha el que l'app permet.

export type PlanKey = "free" | "grup" | "agencia_s" | "agencia_m" | "agencia_l" | "agencia_xl";

export type PlanCaps = {
  label: string;
  short: string;
  // null = sense límit
  groups: number | null;
  activeLinks: number | null;     // enllaços de formulari actius per grup
  tracksPerSong: number;          // pistes d'àudio per cançó
  contracts: boolean;
  invoices: boolean;
  socialHistory: boolean;
  agency: boolean;                // membres de l'agència i permisos
  subsBoard: boolean;             // borsa de suplents (gestor)
  monthly: number;                // € / mes (0 = gratuït)
  yearly: number;                 // € / any
  launchMonthly?: number;         // preu de llançament, si n'hi ha
};

export const PLANS: Record<PlanKey, PlanCaps> = {
  free: { label: "Músic", short: "Gratuït", groups: 1, activeLinks: 3, tracksPerSong: 2, contracts: false, invoices: false, socialHistory: false, agency: false, subsBoard: false, monthly: 0, yearly: 0 },
  grup: { label: "Grup", short: "Grup", groups: 1, activeLinks: null, tracksPerSong: 10, contracts: true, invoices: true, socialHistory: true, agency: false, subsBoard: false, monthly: 12, yearly: 99, launchMonthly: 9 },
  agencia_s: { label: "Agència S", short: "Agència", groups: 5, activeLinks: null, tracksPerSong: 10, contracts: true, invoices: true, socialHistory: true, agency: true, subsBoard: true, monthly: 29, yearly: 290 },
  agencia_m: { label: "Agència M", short: "Agència", groups: 15, activeLinks: null, tracksPerSong: 10, contracts: true, invoices: true, socialHistory: true, agency: true, subsBoard: true, monthly: 59, yearly: 590 },
  agencia_l: { label: "Agència L", short: "Agència", groups: 40, activeLinks: null, tracksPerSong: 10, contracts: true, invoices: true, socialHistory: true, agency: true, subsBoard: true, monthly: 99, yearly: 990 },
  agencia_xl: { label: "Agència XL", short: "Agència", groups: null, activeLinks: null, tracksPerSong: 10, contracts: true, invoices: true, socialHistory: true, agency: true, subsBoard: true, monthly: 149, yearly: 1490 },
};

export const PAID_PLANS: PlanKey[] = ["grup", "agencia_s", "agencia_m", "agencia_l", "agencia_xl"];
export const AGENCY_TIERS: PlanKey[] = ["agencia_s", "agencia_m", "agencia_l", "agencia_xl"];

export function isPlanKey(v: unknown): v is PlanKey {
  return typeof v === "string" && v in PLANS;
}

export type Feature = "contracts" | "invoices" | "socialHistory" | "agency" | "subsBoard";

// Pla mínim que desbloqueja una funció.
export function planForFeature(feature: Feature): PlanKey {
  return feature === "agency" || feature === "subsBoard" ? "agencia_s" : "grup";
}

export const FEATURE_LABELS: Record<Feature, string> = {
  contracts: "Contractes",
  invoices: "Factures i balanç",
  socialHistory: "Historial de xarxes",
  agency: "Membres de l'agència",
  subsBoard: "Borsa de suplents",
};

// El que veu el client sobre el pla del seu workspace.
export type BillingInfo = {
  plan: PlanKey;            // el pla contractat (o free)
  effective: PlanKey;       // el que s'aplica ara (prova, fundador, comped…)
  status: string;
  trialActive: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  founder: boolean;
  hasSubscription: boolean;
  stripeConfigured: boolean;
  founderAvailable: boolean;
  caps: PlanCaps;
};
