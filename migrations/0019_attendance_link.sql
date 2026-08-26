-- Enllaç públic "comparteix per confirmar": els músics confirmen o rebutgen
-- l'assistència des d'un enllaç, identificant-se amb el seu compte.
alter table concerts add column if not exists att_token text;
create unique index if not exists concerts_att_token_key on concerts (att_token) where att_token is not null;
