-- Perfil propi del músic abans d'unir-se a cap grup: foto, xarxes (IG) i
-- contacte guardats directament a profiles (no depenen de cap fila a
-- person_profiles, que necessita un workspace i sense grup encara no en té).
alter table profiles add column if not exists photo_file_id text references files(id) on delete set null;
alter table profiles add column if not exists bio text not null default '';
alter table profiles add column if not exists ig_handle text not null default '';
alter table profiles add column if not exists phone text not null default '';
alter table profiles add column if not exists whatsapp text not null default '';
