-- Convidats d'un esdeveniment intern (assaig, reunio, altre): noms de membres.
-- Buit = tothom del grup.
alter table concerts add column if not exists invited jsonb not null default '[]'::jsonb;
