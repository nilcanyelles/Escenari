-- Cache permanent de límits municipals (Overpass) per al mapa de
-- "Poblacions més repetides" a Estadístiques — un cop es resol un
-- municipi no cal tornar-lo a demanar mai més.
create table if not exists municipality_boundary_cache (
  key text primary key,
  bbox jsonb not null,
  rings jsonb not null,
  updated_at timestamptz not null default now()
);
