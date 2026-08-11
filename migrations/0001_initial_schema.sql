-- Schema inicial: grups, concerts, factures, dades de client i dades de l'empresa.
-- IDs es mantenen com a text (mateix format que feia servir l'app estàtica: "b1", "c1", "F-2026-001").

create table if not exists bands (
  id text primary key,
  name text not null,
  city text not null default '',
  rate integer not null default 0,
  contact text not null default '',
  phone text not null default '',
  tags jsonb not null default '[]'::jsonb,
  members jsonb not null default '[]'::jsonb,
  crew jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists concerts (
  id text primary key,
  date date not null,
  time text not null default '21:00',
  venue text not null default '',
  city text not null default '',
  band_id text references bands(id) on delete set null,
  band_name text not null default '',
  tags jsonb not null default '[]'::jsonb,
  status text not null default 'pendent' check (status in ('confirmat', 'pendent', 'cancel·lat')),
  amount integer not null default 0,
  attendance jsonb not null default '{}'::jsonb,
  substitutes jsonb not null default '{}'::jsonb,
  no_substitute jsonb not null default '{}'::jsonb,
  route_sheet jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists concerts_date_idx on concerts (date);
create index if not exists concerts_band_id_idx on concerts (band_id);

create table if not exists invoices (
  id text primary key,
  concert_id text references concerts(id) on delete cascade,
  client text not null default '',
  band_name text not null default '',
  issue_date date not null,
  due_date date not null,
  amount integer not null default 0,
  state text not null default 'pendent' check (state in ('pagada', 'pendent', 'vençuda')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists invoices_concert_id_idx on invoices (concert_id);
create index if not exists invoices_issue_date_idx on invoices (issue_date);

create table if not exists client_details (
  client_name text primary key,
  cif text not null default '',
  nom text not null default '',
  address text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists company_info (
  id integer primary key default 1,
  nom text not null default 'La Bona Party',
  cif text not null default '',
  address text not null default '',
  iban text not null default '',
  updated_at timestamptz not null default now(),
  constraint company_info_singleton check (id = 1)
);
insert into company_info (id) values (1) on conflict (id) do nothing;

-- Bump updated_at automàticament a cada UPDATE.
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bands_set_updated_at on bands;
create trigger bands_set_updated_at before update on bands
  for each row execute function set_updated_at();

drop trigger if exists concerts_set_updated_at on concerts;
create trigger concerts_set_updated_at before update on concerts
  for each row execute function set_updated_at();

drop trigger if exists invoices_set_updated_at on invoices;
create trigger invoices_set_updated_at before update on invoices
  for each row execute function set_updated_at();

drop trigger if exists client_details_set_updated_at on client_details;
create trigger client_details_set_updated_at before update on client_details
  for each row execute function set_updated_at();

drop trigger if exists company_info_set_updated_at on company_info;
create trigger company_info_set_updated_at before update on company_info
  for each row execute function set_updated_at();
