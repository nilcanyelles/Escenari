-- Enllaços a xarxes socials del grup (Instagram, YouTube, TikTok, Spotify),
-- editables des de "Edita el grup" → Aparença del grup.
alter table bands add column if not exists social_links jsonb;
