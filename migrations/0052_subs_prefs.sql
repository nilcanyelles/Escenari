-- Preferències de suplències del músic (per compte): fins a quina distància
-- se'l pot contactar (0 = qualsevol) i des d'on es mesura; i si se'l pot
-- contactar per a qualsevol instrument o només per als que triï.
alter table profiles add column if not exists subs_max_km integer not null default 0;
alter table profiles add column if not exists subs_home_city text not null default '';
alter table profiles add column if not exists subs_any_instrument boolean not null default true;
alter table profiles add column if not exists subs_instruments jsonb not null default '[]'::jsonb;
