-- Redisseny gestor: enllaços de formulari compartibles per concert,
-- repartiment de pagaments, suplents per grup i borsa de suplències.

-- Enllaços d'un sol ús/caducables per omplir la info o el full de ruta
-- d'un concert des de fora (ajuntaments, promotors...).
create table if not exists share_links (
  id text primary key,
  workspace_id text not null references workspaces(id),
  concert_id text not null references concerts(id) on delete cascade,
  scope text not null default 'both' check (scope in ('info', 'ruta', 'both')),
  recipient_email text not null default '',
  recipient_name text not null default '',
  expires_at timestamptz not null,
  revoked boolean not null default false,
  last_opened_at timestamptz,
  submitted_at timestamptz,
  email_sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists share_links_concert_idx on share_links (concert_id);

-- Repartiment del caixet entre músics/crew d'un concert: { "Nom": import }.
alter table concerts add column if not exists payouts jsonb not null default '{}'::jsonb;

-- Suplents de confiança de cada grup: [{ name, instruments, phone, email }].
alter table bands add column if not exists backups jsonb not null default '[]'::jsonb;

-- Cerques de suplent publicades quan ningú del grup pot cobrir un bolo.
create table if not exists backup_requests (
  id text primary key,
  workspace_id text not null references workspaces(id),
  band_id text not null references bands(id) on delete cascade,
  concert_id text not null references concerts(id) on delete cascade,
  member_name text not null default '',
  instruments jsonb not null default '[]'::jsonb,
  note text not null default '',
  status text not null default 'oberta' check (status in ('oberta', 'coberta', 'cancel·lada')),
  created_at timestamptz not null default now()
);
create index if not exists backup_requests_status_idx on backup_requests (status);
create index if not exists backup_requests_concert_idx on backup_requests (concert_id);

-- Candidatures de músics d'Escenari a una cerca de suplent.
create table if not exists backup_applications (
  request_id text not null references backup_requests(id) on delete cascade,
  clerk_user_id text not null references profiles(clerk_user_id) on delete cascade,
  message text not null default '',
  status text not null default 'pendent' check (status in ('pendent', 'acceptada', 'rebutjada')),
  created_at timestamptz not null default now(),
  primary key (request_id, clerk_user_id)
);
