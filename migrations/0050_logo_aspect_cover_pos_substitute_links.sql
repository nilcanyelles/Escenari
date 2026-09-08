-- Logo del grup amb la proporció triada (quadrat, 4:3, 16:9 o 3:1) i punt
-- focal de la portada (background-position), tots dos triats des
-- d'"Edita el grup" (retall del logo i arrossegament de la portada).
alter table bands add column if not exists logo_aspect text not null default '1:1';
alter table bands add column if not exists cover_pos text not null default '50% 50%';

-- Cerques de suplent proposades des de l'enllaç de confirmació (/conf):
-- enllaç directe (/s/token) perquè el suplent proposat es creï el compte i
-- s'hi presenti, i qui l'ha proposat (el membre que no pot venir).
alter table backup_requests add column if not exists token text;
create unique index if not exists backup_requests_token_key on backup_requests (token) where token is not null;
alter table backup_requests add column if not exists proposed_by text not null default '';
