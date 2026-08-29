-- Pas 1 de moure els fitxers fora de Postgres (Vercel Blob): els fitxers
-- nous guardaran aquí la URL del blob en lloc del binari a "data". Es manté
-- "data" per compatibilitat amb els fitxers ja existents fins que es
-- migrin (quan la quota de Neon ho permeti).
alter table files add column if not exists blob_url text;
