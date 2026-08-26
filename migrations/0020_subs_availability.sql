-- Disponibilitat per a suplències: el músic indica que se'l pot tenir en
-- compte i si el seu perfil és visible per als gestors que busquen suplent.
alter table person_profiles add column if not exists open_to_subs boolean not null default false;
alter table person_profiles add column if not exists profile_public boolean not null default true;
