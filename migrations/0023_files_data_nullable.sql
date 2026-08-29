-- Pas 2 de moure els fitxers a Vercel Blob: els fitxers migrats ja no
-- guarden el binari aquí (queda a "blob_url"), així que "data" ha de poder
-- ser nul.
alter table files alter column data drop not null;
