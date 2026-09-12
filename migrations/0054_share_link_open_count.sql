-- Nombre de cops que s'ha obert l'enllaç del formulari de regidor, per al
-- seguiment de Comparteix (independent del codi d'accés).
alter table share_links add column if not exists open_count integer not null default 0;
