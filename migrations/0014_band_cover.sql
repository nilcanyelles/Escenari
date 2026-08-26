-- Imatge de portada del grup (estil LinkedIn) a la capcalera de la pagina.
alter table bands add column if not exists cover_url text not null default '';
