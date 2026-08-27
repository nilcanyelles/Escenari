-- Cache permanent de geocodificació (poblacions/recintes -> lat/lon), compartit
-- per tot l'app: un cop es resol una població no cal tornar-la a demanar mai
-- més a l'API externa, encara que aquella no respongui puntualment.
create table if not exists geocode_cache (
  query text primary key,
  lat double precision,
  lon double precision,
  updated_at timestamptz not null default now()
);
