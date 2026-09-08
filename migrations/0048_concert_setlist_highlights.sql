-- Cançons destacades de la setlist assignada, per assaig — la mateixa
-- setlist es pot repetir a diversos assaigs, cada un amb les seves pròpies
-- cançons marcades (clau = títol de la cançó), per això viu al concert i
-- no a la setlist.
alter table concerts add column if not exists setlist_highlights jsonb not null default '{}'::jsonb;
