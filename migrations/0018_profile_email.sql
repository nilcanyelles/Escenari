-- Correu de contacte propi del perfil (pot diferir del correu d'inici de sessió).
alter table person_profiles add column if not exists contact_email text not null default '';
