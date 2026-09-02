-- Agència del gestor (el workspace): nom i logotip que surten a dalt de la
-- barra de grups en comptes de "Tots els grups".
alter table workspaces add column if not exists logo text not null default '';

-- Disponibilitat diària per a suplències (verd/vermell), per compte.
create table if not exists subs_availability (
  clerk_user_id text not null references profiles(clerk_user_id) on delete cascade,
  day date not null,
  available boolean not null,
  primary key (clerk_user_id, day)
);

-- Cançons personals (biblioteca del músic): sense grup ni workspace, amb
-- propietari. Els fitxers d'aquestes cançons tampoc tenen workspace.
alter table songs alter column band_id drop not null;
alter table songs alter column workspace_id drop not null;
alter table songs add column if not exists owner_clerk_user_id text references profiles(clerk_user_id) on delete cascade;
create index if not exists songs_owner_idx on songs (owner_clerk_user_id);
alter table files alter column workspace_id drop not null;
