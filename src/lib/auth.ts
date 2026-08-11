export const SESSION_COOKIE = "escenari_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 dies

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("Falta la variable d'entorn SESSION_SECRET");
  return s;
}

function toBase64Url(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let str = "";
  for (const b of arr) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const str = atob(b64);
  const arr = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) arr[i] = str.charCodeAt(i);
  return arr;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function sign(payload: string): Promise<string> {
  const key = await hmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toBase64Url(sig);
}

export async function createSessionToken(): Promise<string> {
  const payload = JSON.stringify({ exp: Date.now() + SESSION_MAX_AGE * 1000 });
  const encoded = toBase64Url(new TextEncoder().encode(payload).buffer as ArrayBuffer);
  return `${encoded}.${await sign(encoded)}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [encoded, sig] = parts;
  const expectedSig = await sign(encoded);
  if (sig !== expectedSig) return false;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded)));
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

// Compara contrasenyes via HMAC (sortida sempre de 32 bytes) per evitar filtrar
// la longitud de la contrasenya real a través del temps de comparació.
export async function checkPassword(input: string): Promise<boolean> {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false;
  const key = await hmacKey();
  const [a, b] = await Promise.all([
    crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input)),
    crypto.subtle.sign("HMAC", key, new TextEncoder().encode(expected)),
  ]);
  const aArr = new Uint8Array(a);
  const bArr = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < aArr.length; i++) diff |= aArr[i] ^ bArr[i];
  return diff === 0;
}
