-- Membres de l'agència (els gestors d'un mateix workspace) amb permisos:
-- càrrec, si manen a l'agència, si poden crear grups i quins grups veuen
-- (tots, o només els assignats).
alter table profiles add column if not exists agency_role text not null default '';
alter table profiles add column if not exists agency_owner boolean not null default false;
alter table profiles add column if not exists can_create_groups boolean not null default true;
alter table profiles add column if not exists view_all_groups boolean not null default true;
alter table profiles add column if not exists assigned_band_ids jsonb not null default '[]'::jsonb;
-- Els gestors que ja hi eren manen a la seva agència.
update profiles set agency_owner = true where role = 'manager' and workspace_id is not null;

-- Invitacions a l'agència (enllaç /j/token): qui hi entra queda vinculat a
-- l'agència amb els permisos que s'hi van marcar.
create table if not exists agency_invitations (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  email text not null default '',
  name text not null default '',
  role_label text not null default '',
  can_create_groups boolean not null default true,
  view_all_groups boolean not null default true,
  assigned_band_ids jsonb not null default '[]'::jsonb,
  status text not null default 'pendent',
  invited_by text not null default '',
  accepted_by text,
  created_at timestamptz not null default now()
);
create index if not exists agency_invitations_ws_idx on agency_invitations (workspace_id);

-- Invitacions de grup amb enllaç per reclamar el perfil (/i/token), també
-- per a gent sense correu (aleshores només val l'enllaç) i per a crew.
alter table invitations add column if not exists token text;
update invitations set token = 'i_' || md5(random()::text || id) where token is null;
create unique index if not exists invitations_token_key on invitations (token);
alter table invitations add column if not exists as_crew boolean not null default false;
alter table invitations add column if not exists role_label text not null default '';
drop index if exists invitations_band_email_key;
create unique index if not exists invitations_band_email_key on invitations (band_id, lower(email)) where email <> '';

-- Instruments personalitzats (afegits des del selector), amb la icona d'un
-- altre instrument.
create table if not exists custom_instruments (
  name_key text primary key,
  name text not null,
  icon text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now()
);
