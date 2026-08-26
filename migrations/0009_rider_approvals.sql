-- Aprovació de riders per concert: el gestor envia el rider a una persona
-- externa (tècnic de la sala, producció del festival), que pot aprovar-lo o
-- respondre amb una contraproposta (contrarider) editada.

create table if not exists rider_approvals (
  id text primary key,
  workspace_id text not null references workspaces(id),
  concert_id text not null references concerts(id) on delete cascade,
  rider_id text not null references riders(id) on delete cascade,
  recipient_name text not null default '',
  recipient_email text not null default '',
  status text not null default 'pendent' check (status in ('pendent', 'contrarider', 'aprovat')),
  counter_content jsonb,
  counter_note text not null default '',
  email_sent_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rider_approvals_concert_idx on rider_approvals (concert_id);

drop trigger if exists rider_approvals_set_updated_at on rider_approvals;
create trigger rider_approvals_set_updated_at before update on rider_approvals
  for each row execute function set_updated_at();
