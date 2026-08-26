-- Perfils públics de músics: pàgina compartible amb foto, instruments,
-- calendari d'assistència i repertori. Editable pel músic si té compte
-- d'Escenari (vinculat per clerk_user_id) o pel gestor si no en té.

create table if not exists person_profiles (
  id text primary key, -- token compartible (p_...)
  workspace_id text not null references workspaces(id),
  person_name text not null,
  clerk_user_id text references profiles(clerk_user_id) on delete set null,
  photo_file_id text references files(id) on delete set null,
  bio text not null default '',
  ig_handle text not null default '',
  hidden_bands jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists person_profiles_ws_name_key on person_profiles (workspace_id, lower(person_name));

drop trigger if exists person_profiles_set_updated_at on person_profiles;
create trigger person_profiles_set_updated_at before update on person_profiles
  for each row execute function set_updated_at();
