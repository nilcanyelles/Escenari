-- Riders tècnics i setlists per grup, seleccionables per concert i
-- compartibles públicament (PDF imprimible) via token.

create table if not exists riders (
  id text primary key,
  workspace_id text not null references workspaces(id),
  band_id text not null references bands(id) on delete cascade,
  name text not null default 'Rider',
  content jsonb not null default '{}'::jsonb,
  public_token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists riders_band_idx on riders (band_id);

create table if not exists setlists (
  id text primary key,
  workspace_id text not null references workspaces(id),
  band_id text not null references bands(id) on delete cascade,
  name text not null default 'Setlist',
  songs jsonb not null default '[]'::jsonb,
  public_token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists setlists_band_idx on setlists (band_id);

drop trigger if exists riders_set_updated_at on riders;
create trigger riders_set_updated_at before update on riders
  for each row execute function set_updated_at();
drop trigger if exists setlists_set_updated_at on setlists;
create trigger setlists_set_updated_at before update on setlists
  for each row execute function set_updated_at();

-- Cada concert pot tenir un rider i una setlist assignats.
alter table concerts add column if not exists rider_id text references riders(id) on delete set null;
alter table concerts add column if not exists setlist_id text references setlists(id) on delete set null;

-- Permisos d'edició per a artistes concrets del grup.
create table if not exists band_editors (
  band_id text not null references bands(id) on delete cascade,
  clerk_user_id text not null references profiles(clerk_user_id) on delete cascade,
  can_riders boolean not null default false,
  can_setlists boolean not null default false,
  primary key (band_id, clerk_user_id)
);
