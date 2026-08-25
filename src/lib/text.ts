// Normalitza text per a cerques que no distingeixin accents (p. ex. "angles"
// ha de trobar "anglès").
export function normalize(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
