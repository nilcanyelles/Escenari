// Detecta línies formades només per acords (el format clàssic de "acords a
// sobre de la lletra", en solfeig o en notació anglosaxona) i les
// converteix al format ChordPro [Acord] que fa servir l'app, fusionant-les
// amb la línia de lletra de sota, a la posició exacta on cauen.
//
// Perquè una paraula normal de la lletra (p. ex. "sol", "fa", "la", "si",
// totes paraules catalanes molt comunes que també són noms de nota) mai es
// confongui amb un acord, NOMÉS es tracta com a línia d'acords quan TOTA la
// línia hi encaixa — n'hi ha prou que un sol token no sigui un acord vàlid
// perquè es descarti la línia sencera.

const SOLFEGE_TO_LETTER: Record<string, string> = { Do: "C", Re: "D", Mi: "E", Fa: "F", Sol: "G", La: "A", Si: "B" };
const ROOT = "(?:Do|Re|Mi|Fa|Sol|La|Si|[A-G])";
const ACCIDENTAL = "(?:#|b)?";
const QUALITY = "(?:maj7|maj9|maj|m7b5|dim7|dim|aug|sus2|sus4|sus|add9|add11|m6|m7|m9|m|6|7|9|11|13|5|°|\\+)?";
const CHORD_TOKEN_RE = new RegExp(`^(${ROOT})(${ACCIDENTAL})(${QUALITY})(?:/(${ROOT})(${ACCIDENTAL}))?$`);

// Normalitza un token a notació anglosaxona (Do -> C, Rem -> Dm...) perquè
// funcioni amb la transposició existent (que només entén A-G). Retorna null
// si el token no és un acord vàlid.
function normalizeChord(tok: string): string | null {
  const m = CHORD_TOKEN_RE.exec(tok);
  if (!m) return null;
  const root = SOLFEGE_TO_LETTER[m[1]] || m[1];
  let out = root + (m[2] || "") + (m[3] || "");
  if (m[4]) {
    const bassRoot = SOLFEGE_TO_LETTER[m[4]] || m[4];
    out += "/" + bassRoot + (m[5] || "");
  }
  return out;
}

type ChordToken = { chord: string; start: number };

// Si la línia sencera és una seqüència d'acords espaiats, retorna els
// acords (ja normalitzats) amb la seva posició dins la línia; si hi ha cap
// paraula que no sigui un acord, o si no hi ha prou espaiat, retorna null.
function detectChordLine(line: string): ChordToken[] | null {
  if (!line.trim()) return null;
  const matches = [...line.matchAll(/\S+/g)];
  if (matches.length < 2) return null;
  const tokens: ChordToken[] = [];
  for (const m of matches) {
    const norm = normalizeChord(m[0]);
    if (!norm) return null;
    tokens.push({ chord: norm, start: m.index ?? 0 });
  }
  const nonSpace = matches.reduce((s, m) => s + m[0].length, 0);
  if (nonSpace / line.length > 0.7) return null; // massa atapeït per ser una línia d'acords
  return tokens;
}

function mergeIntoLyric(lyricLine: string, tokens: ChordToken[]): string {
  let result = lyricLine;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const pos = Math.min(tokens[i].start, result.length);
    result = result.slice(0, pos) + `[${tokens[i].chord}]` + result.slice(pos);
  }
  return result;
}

// Converteix un text (lletra pegada des d'algun lloc, típicament amb acords
// en línies separades) al format ChordPro intern. Si no hi detecta cap
// línia d'acords, retorna el text tal qual.
export function convertChordLyrics(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;
  let converted = false;
  while (i < lines.length) {
    const tokens = detectChordLine(lines[i]);
    if (tokens) {
      const next = lines[i + 1];
      if (next !== undefined && next.trim() && !detectChordLine(next)) {
        out.push(mergeIntoLyric(next, tokens));
        i += 2;
      } else {
        // Línia d'acords sola, sense lletra a sota (p. ex. una intro instrumental).
        out.push(tokens.map((t) => `[${t.chord}]`).join(" "));
        i += 1;
      }
      converted = true;
    } else {
      out.push(lines[i]);
      i += 1;
    }
  }
  return converted ? out.join("\n") : text;
}
