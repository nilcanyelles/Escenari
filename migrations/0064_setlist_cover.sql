-- Foto de portada d'una setlist, mostrada a l'esquerra de la targeta i de
-- l'editor — igual que la portada d'un grup o d'una cançó.
alter table setlists add column if not exists cover_url text not null default '';
