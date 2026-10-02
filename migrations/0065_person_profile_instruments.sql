-- Instruments propis d'una persona (independents de cada grup): el que es
-- mostra a la taula d'un grup segueix sent només un subconjunt d'aquests.
alter table person_profiles add column if not exists instruments jsonb not null default '[]'::jsonb;
