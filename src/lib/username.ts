// Nom d'usuari (@...): identificador curt, únic, que tria la persona en
// crear el seu perfil — es desa sense la "@" (es mostra sempre amb ella).

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

// Treu accents/diacrítics i es queda només amb minúscules, dígits i "_".
export function slugifyUsername(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9_]/g, "");
}

export function isValidUsername(u: string): boolean {
  return u.length >= USERNAME_MIN && u.length <= USERNAME_MAX && /^[a-z][a-z0-9_]*$/.test(u);
}

// Suggeriments base a partir del nom i cognoms (p. ex. "Nil Canyelles"):
// nomcognoms, ncognoms, nomc — el mateix patró que whatsapp/instagram fan
// servir per generar handles.
export function baseUsernameSuggestions(fullName: string): string[] {
  const parts = fullName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return [];
  const [nom, ...rest] = parts;
  const cognoms = rest.join("");
  const out: string[] = [];
  function add(s: string) {
    const v = slugifyUsername(s);
    if (v.length >= USERNAME_MIN && !out.includes(v)) out.push(v);
  }
  if (cognoms) {
    add(nom + cognoms);
    add(nom[0] + cognoms);
    add(nom + cognoms[0]);
    add(nom.slice(0, 3) + cognoms[0]);
  }
  add(nom);
  if (cognoms) add(cognoms);
  return out;
}

// Variants amb un sufix numèric (1 o 2 xifres) per quan el nom triat ja
// existeix — es proven en ordre fins trobar-ne de disponibles.
export function* digitSuffixVariants(base: string): Generator<string> {
  for (let i = 1; i <= 9; i++) yield base + i;
  for (let i = 10; i <= 99; i++) yield base + i;
}
