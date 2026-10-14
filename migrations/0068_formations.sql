-- Formacions d'un grup: lineups amb músics col·locats en un pla d'escenari
-- (mateix patró que riders/setlists — taula pròpia amb "slots" jsonb). Una
-- formació es pot marcar "preferida" (preferred) — només una per grup, es
-- desmarca la resta en marcar-ne una de nova des del servidor.
create table if not exists formations (
  id text primary key,
  workspace_id text not null,
  band_id text not null references bands(id) on delete cascade,
  name text not null default 'Formació',
  preferred boolean not null default false,
  slots jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists formations_band_idx on formations (band_id);

-- Formació triada per a la convocatòria d'un bolo concret, i qui ocupa cada
-- posició (slot) d'aquella formació — permet triar els músics "encaixant"
-- amb la formació en comptes d'una llista plana sense cap estructura.
alter table concerts add column if not exists formation_id text;
alter table concerts add column if not exists formation_assignments jsonb not null default '{}'::jsonb;
