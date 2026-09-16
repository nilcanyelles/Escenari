-- La foto de perfil d'un artista sense grup encara (workspace_id null a
-- profiles) no té cap workspace a qui penjar el fitxer.
alter table files alter column workspace_id drop not null;
