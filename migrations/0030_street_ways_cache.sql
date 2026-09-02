-- Cache permanent dels carrers reals que es demanen a Overpass per al
-- mini-mapa del pòster (per punt geogràfic arrodonit + radi): un cop es
-- resol un lloc no cal tornar a demanar-lo mai més a l'API externa, encara
-- que aquella falli puntualment (com passa sovint) — sobretot útil perquè
-- un grup sol tocar moltes vegades als mateixos recintes.
create table if not exists street_ways_cache (
  key text primary key,
  bbox jsonb not null,
  ways jsonb not null,
  updated_at timestamptz not null default now()
);
