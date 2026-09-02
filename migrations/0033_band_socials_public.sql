-- Xarxes socials i pàgina pública del grup.
--  · public_token: enllaç compartible de la pàgina pública del grup (/g/token).
--  · bio: text de presentació que es mostra (i s'edita) a la pàgina pública.
--  · social_tracking: de quines xarxes es fa seguiment ({"instagram": true,
--    ...}); sense valor explícit, es fa seguiment de les que tinguin enllaç
--    o compte connectat.
alter table bands add column if not exists public_token text;
create unique index if not exists bands_public_token_key on bands (public_token) where public_token is not null;
alter table bands add column if not exists bio text not null default '';
alter table bands add column if not exists social_tracking jsonb not null default '{}'::jsonb;

-- Comptes connectats per OAuth (Instagram, TikTok): els tokens es queden al
-- servidor i el cron diari els fa servir per llegir-ne els seguidors.
create table if not exists band_social_accounts (
  band_id text not null references bands(id) on delete cascade,
  platform text not null,
  external_id text not null default '',
  username text not null default '',
  access_token text not null default '',
  refresh_token text not null default '',
  expires_at timestamptz,
  connected_at timestamptz not null default now(),
  primary key (band_id, platform)
);

-- Instantànies diàries de les xifres de cada grup (una per dia i grup):
-- l'evolució mensual de seguidors i oients es treu de l'última de cada mes.
create table if not exists band_social_snapshots (
  band_id text not null references bands(id) on delete cascade,
  taken_on date not null,
  stats jsonb not null default '{}'::jsonb,
  primary key (band_id, taken_on)
);
