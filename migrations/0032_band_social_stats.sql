-- Anàlisi de xarxes socials del grup (seguidors Instagram, oients mensuals
-- Spotify, seguidors TikTok, visites totals YouTube), introduïts a mà i
-- mostrats a la pestanya Inici en comptes de l'equip (que ja té la seva
-- pròpia pestanya).
alter table bands add column if not exists social_stats jsonb;
