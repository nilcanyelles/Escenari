-- App de navegació preferida del músic: quan es clica una ubicació al full
-- de ruta, s'obre amb l'enllaç d'aquesta app en comptes de sempre Google Maps.
alter table profiles add column if not exists nav_app text not null default 'google';
alter table profiles drop constraint if exists profiles_nav_app_check;
alter table profiles add constraint profiles_nav_app_check check (nav_app in ('google', 'waze', 'apple'));
