-- Casella "Pagat" a la taula d'Esdeveniments, independent de l'estat.
alter table concerts add column if not exists paid boolean not null default false;
