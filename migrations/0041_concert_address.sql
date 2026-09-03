-- Adreça del concert (carrer, número, població) — s'empleix automàticament
-- en triar un recinte a "Informació general"; Població ja no hi és com a
-- camp propi perquè queda inclosa aquí.
alter table concerts add column if not exists address text not null default '';
