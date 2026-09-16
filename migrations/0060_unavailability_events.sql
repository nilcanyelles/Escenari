-- Esdeveniments personals de "no disponible" (vacances, etc.): viuen al
-- perfil personal de cada músic/crew, no a cap grup, i serveixen perquè els
-- gestors sàpiguen, en convocar-lo, si coincideix amb un dia que ha marcat
-- com a no disponible.
create table if not exists unavailability_events (
  id text primary key,
  clerk_user_id text not null references profiles(clerk_user_id) on delete cascade,
  title text not null,
  start_date date not null,
  start_time text not null default '',
  end_date date not null,
  end_time text not null default '',
  all_day boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists unavailability_events_user_idx on unavailability_events (clerk_user_id, start_date, end_date);
