-- Hora exacta del concert (HH:MM), opcional i diferent de "time" (que ara
-- és només el tram aproximat del dia: matí/migdia/tarda/vespre/matinada).
-- Buida per defecte: mentre ho estigui, no compta per al percentatge de
-- la pestanya "Informació general".
alter table concerts add column if not exists exact_time text not null default '';
