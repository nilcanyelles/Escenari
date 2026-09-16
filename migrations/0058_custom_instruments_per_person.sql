-- Els instruments personalitzats deixen de ser globals: cada compte té els
-- seus (dos músics poden afegir-ne un amb el mateix nom sense compartir
-- fila), i només qui l'ha creat el veu al seu selector.
alter table custom_instruments drop constraint if exists custom_instruments_pkey;
alter table custom_instruments add primary key (created_by, name_key);
create index if not exists custom_instruments_created_by_idx on custom_instruments (created_by);
