-- Ordre manual del repertori (arrossegar per endreçar): només afecta les
-- cançons de grup — les de la biblioteca personal es continuen ordenant
-- per títol, ja que no tenen cap pantalla per reordenar-les a mà.
alter table songs add column if not exists sort_order integer not null default 0;

update songs s set sort_order = t.rn - 1
from (
  select id, row_number() over (partition by band_id order by lower(title)) as rn
  from songs
  where band_id is not null
) t
where s.id = t.id;
