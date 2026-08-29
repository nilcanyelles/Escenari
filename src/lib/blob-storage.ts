import { put, get, del } from "@vercel/blob";

// Emmagatzematge de fitxers fora de Postgres (Vercel Blob), privat: cada
// lectura/escriptura passa pel servidor amb el BLOB_READ_WRITE_TOKEN, mai
// s'exposa una URL directa al navegador. Així les baixades (àudios,
// partitures, imatges...) ja no consumeixen la quota de transferència de
// Neon — abans es guardaven com a bytea dins la mateixa base de dades.

export async function uploadFileBlob(pathname: string, data: Buffer, contentType: string): Promise<string> {
  const blob = await put(pathname, data, { access: "private", contentType, addRandomSuffix: false });
  return blob.url;
}

export async function getFileBlob(urlOrPathname: string, rangeHeader?: string | null) {
  return get(urlOrPathname, { access: "private", headers: rangeHeader ? { range: rangeHeader } : undefined });
}

export async function deleteFileBlob(urlOrPathname: string): Promise<void> {
  await del(urlOrPathname);
}
