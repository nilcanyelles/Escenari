-- Horaris que es mostren al pòster del concert (l'oficial + els que
-- s'hagin afegit per altres actuacions el mateix dia), editables des del
-- mateix modal del pòster.
alter table concerts add column if not exists poster_schedule jsonb;
