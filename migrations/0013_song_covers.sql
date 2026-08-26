-- Caràtula de cançó (URL externa, p. ex. iTunes/Deezer) per a les vistes
-- estil Spotify i l'autocompletat de dades.
alter table songs add column if not exists cover_url text not null default '';
