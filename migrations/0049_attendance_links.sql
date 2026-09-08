-- Enllaços de confirmació d'assistència per a més d'un concert alhora
-- (/conf/token): el gestor tria quins concerts propers del grup hi entren,
-- o bé "tots els propers" (que inclou també els que es creïn després).
-- L'enllaç d'un sol concert segueix sent concerts.att_token.
create table if not exists attendance_links (
  id text primary key,
  workspace_id text not null references workspaces(id),
  band_id text not null references bands(id) on delete cascade,
  concert_ids jsonb not null default '[]'::jsonb,
  all_future boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists attendance_links_band_idx on attendance_links (band_id);
