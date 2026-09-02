-- Cançons que el músic amaga del seu perfil públic (ids de songs): per
-- defecte s'hi veu tot el repertori dels seus grups visibles.
alter table person_profiles add column if not exists hidden_songs jsonb not null default '[]'::jsonb;
