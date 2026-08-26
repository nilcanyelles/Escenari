-- Suite de gestió: repertori de cançons, fitxers adjunts, moviments
-- econòmics, seguiment de contactes, checklists, registre de pràctica,
-- tipus d'esdeveniment i subscripció iCal.

-- Repertori per grup: lletres i acords (format ChordPro amb [Am] inline).
create table if not exists songs (
  id text primary key,
  workspace_id text not null references workspaces(id),
  band_id text not null references bands(id) on delete cascade,
  title text not null,
  artist text not null default '',
  tempo integer not null default 0,
  song_key text not null default '',
  duration text not null default '',
  tags jsonb not null default '[]'::jsonb,
  notes text not null default '',
  lyrics text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists songs_band_idx on songs (band_id);

drop trigger if exists songs_set_updated_at on songs;
create trigger songs_set_updated_at before update on songs
  for each row execute function set_updated_at();

-- Fitxers (gravacions, documents, vídeos, memos de veu) desats a la base de
-- dades (límit de mida controlat a l'aplicació).
create table if not exists files (
  id text primary key,
  workspace_id text not null references workspaces(id),
  band_id text references bands(id) on delete cascade,
  song_id text references songs(id) on delete cascade,
  name text not null,
  mime text not null default 'application/octet-stream',
  size integer not null default 0,
  data bytea not null,
  uploaded_by text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists files_band_idx on files (band_id);
create index if not exists files_song_idx on files (song_id);

-- Les cançons d'una setlist poden enllaçar amb el repertori.
-- (les setlists guarden songs com a jsonb; s'hi afegeix songId opcional)

-- Moviments econòmics: ingressos i despeses amb categories pròpies.
create table if not exists transactions (
  id text primary key,
  workspace_id text not null references workspaces(id),
  kind text not null check (kind in ('ingres', 'despesa')),
  category text not null default '',
  amount integer not null default 0,
  tdate date not null,
  concert_id text references concerts(id) on delete set null,
  member text not null default '',
  fund text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists transactions_ws_idx on transactions (workspace_id, tdate);

drop trigger if exists transactions_set_updated_at on transactions;
create trigger transactions_set_updated_at before update on transactions
  for each row execute function set_updated_at();

-- Historial d'interaccions amb contactes + seguiments programats.
create table if not exists contact_interactions (
  id text primary key,
  workspace_id text not null references workspaces(id),
  contact_id text not null references contacts(id) on delete cascade,
  idate date not null,
  note text not null default '',
  next_date date,
  next_note text not null default '',
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists contact_interactions_contact_idx on contact_interactions (contact_id);
create index if not exists contact_interactions_next_idx on contact_interactions (workspace_id, next_date) where not done;

-- Checklists jeràrquiques per concert.
create table if not exists checklists (
  id text primary key,
  workspace_id text not null references workspaces(id),
  concert_id text references concerts(id) on delete cascade,
  name text not null default 'Checklist',
  created_at timestamptz not null default now()
);
create index if not exists checklists_concert_idx on checklists (concert_id);

create table if not exists checklist_items (
  id text primary key,
  checklist_id text not null references checklists(id) on delete cascade,
  parent_id text references checklist_items(id) on delete cascade,
  text text not null default '',
  assignee text not null default '',
  due date,
  status text not null default 'pendent' check (status in ('pendent', 'en curs', 'fet')),
  position integer not null default 0
);
create index if not exists checklist_items_list_idx on checklist_items (checklist_id, position);

-- Registre de pràctica personal (per a artistes).
create table if not exists practice_goals (
  id text primary key,
  clerk_user_id text not null references profiles(clerk_user_id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create table if not exists practice_entries (
  id text primary key,
  clerk_user_id text not null references profiles(clerk_user_id) on delete cascade,
  goal_id text references practice_goals(id) on delete set null,
  pdate date not null,
  minutes integer not null default 0,
  notes text not null default ''
);
create index if not exists practice_entries_user_idx on practice_entries (clerk_user_id, pdate);

-- Tipus d'esdeveniment al calendari (bolo, assaig, reunió, altre).
alter table concerts add column if not exists kind text not null default 'bolo'
  check (kind in ('bolo', 'assaig', 'reunio', 'altre'));

-- Token per a la subscripció iCal i el feed públic d'esdeveniments.
alter table workspaces add column if not exists ics_token text;
update workspaces set ics_token = 'ics_' || md5(random()::text || id) where ics_token is null;
