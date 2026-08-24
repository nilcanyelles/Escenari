-- Multi-tenància + comptes Clerk.
-- Cada gestor té un "workspace" propi; tota la data existent passa al
-- workspace 'ws_legacy', que reclama el primer gestor que completi l'alta.
-- Els artistes no tenen workspace: veuen els concerts dels grups on són membres.

create table if not exists workspaces (
  id text primary key,
  name text not null default '',
  created_at timestamptz not null default now()
);
insert into workspaces (id, name) values ('ws_legacy', 'Escenari') on conflict (id) do nothing;

create table if not exists profiles (
  clerk_user_id text primary key,
  email text not null default '',
  role text not null check (role in ('manager', 'artist')),
  name text not null default '',
  instruments jsonb not null default '[]'::jsonb,
  workspace_id text references workspaces(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_email_idx on profiles (lower(email));
create index if not exists profiles_workspace_idx on profiles (workspace_id);

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at before update on profiles
  for each row execute function set_updated_at();

-- workspace_id a totes les taules de dades. El default 'ws_legacy' serveix
-- per omplir les files existents; després es treu perquè cada insert nou
-- l'hagi de passar explícitament (evita fuites entre workspaces per oblit).
alter table bands add column if not exists workspace_id text not null default 'ws_legacy' references workspaces(id);
alter table bands alter column workspace_id drop default;
create index if not exists bands_workspace_idx on bands (workspace_id);

alter table concerts add column if not exists workspace_id text not null default 'ws_legacy' references workspaces(id);
alter table concerts alter column workspace_id drop default;
create index if not exists concerts_workspace_idx on concerts (workspace_id);

alter table invoices add column if not exists workspace_id text not null default 'ws_legacy' references workspaces(id);
alter table invoices alter column workspace_id drop default;
create index if not exists invoices_workspace_idx on invoices (workspace_id);
-- Els números de factura (F-2026-001...) són per workspace: la clau passa a ser composta.
alter table invoices drop constraint invoices_pkey;
alter table invoices add primary key (workspace_id, id);

alter table contacts add column if not exists workspace_id text not null default 'ws_legacy' references workspaces(id);
alter table contacts alter column workspace_id drop default;
drop index if exists contacts_name_lower_key;
create unique index if not exists contacts_ws_name_lower_key on contacts (workspace_id, lower(name));

alter table client_details add column if not exists workspace_id text not null default 'ws_legacy' references workspaces(id);
alter table client_details alter column workspace_id drop default;
alter table client_details drop constraint client_details_pkey;
alter table client_details add primary key (workspace_id, client_name);

-- company_info deixa de ser una fila única global: una fila per workspace.
alter table company_info drop constraint company_info_singleton;
alter table company_info add column if not exists workspace_id text not null default 'ws_legacy' references workspaces(id);
alter table company_info alter column workspace_id drop default;
alter table company_info drop constraint company_info_pkey;
alter table company_info drop column id;
alter table company_info add primary key (workspace_id);
alter table company_info alter column nom set default '';

-- Identitat visual i codi d'invitació per grup.
alter table bands add column if not exists join_code text;
alter table bands add column if not exists logo text not null default '';
alter table bands add column if not exists color1 text not null default '';
alter table bands add column if not exists color2 text not null default '';
update bands set join_code = upper(substr(md5(random()::text || id), 1, 6)) where join_code is null;
alter table bands alter column join_code set not null;
create unique index if not exists bands_join_code_key on bands (join_code);

-- Pertinença d'artistes a grups. member_name és el nom amb què la persona
-- apareix a bands.members (i per tant la clau d'assistència als concerts).
create table if not exists band_members (
  band_id text not null references bands(id) on delete cascade,
  clerk_user_id text not null references profiles(clerk_user_id) on delete cascade,
  member_name text not null default '',
  joined_at timestamptz not null default now(),
  primary key (band_id, clerk_user_id)
);
create index if not exists band_members_user_idx on band_members (clerk_user_id);

create table if not exists invitations (
  id text primary key,
  band_id text not null references bands(id) on delete cascade,
  email text not null,
  name text not null default '',
  status text not null default 'pendent' check (status in ('pendent', 'acceptada', 'rebutjada')),
  created_at timestamptz not null default now()
);
create unique index if not exists invitations_band_email_key on invitations (band_id, lower(email));
create index if not exists invitations_email_idx on invitations (lower(email));
