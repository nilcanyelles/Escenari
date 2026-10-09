-- Setlists personals (biblioteca del músic): sense grup ni workspace, amb
-- propietari — igual que les cançons personals (0035_agency_subs_library).
alter table setlists alter column band_id drop not null;
alter table setlists alter column workspace_id drop not null;
alter table setlists add column if not exists owner_clerk_user_id text references profiles(clerk_user_id) on delete cascade;
create index if not exists setlists_owner_idx on setlists (owner_clerk_user_id);
