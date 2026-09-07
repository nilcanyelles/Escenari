-- Si el concert ja es pot fer públic (xarxes, cartell...) o cal esperar
-- fins a una data concreta — a "Informació general", al costat del tipus
-- d'esdeveniment.
alter table concerts add column if not exists can_announce boolean not null default true;
alter table concerts add column if not exists announce_after text not null default '';
