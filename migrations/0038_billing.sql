-- Plans de pagament: el pla viu al workspace (l'agència o el grup propi).
--  · plan: free | grup | agencia_s | agencia_m | agencia_l | agencia_xl
--  · plan_status: none | trialing | active | past_due | canceled | unpaid | comped
--  · trial_ends_at: prova de 14 dies (Agència S) sense targeta.
--  · founder: "membre fundador" (Grup de per vida, pagament únic).
alter table workspaces add column if not exists plan text not null default 'free';
alter table workspaces add column if not exists plan_status text not null default 'none';
alter table workspaces add column if not exists stripe_customer_id text;
alter table workspaces add column if not exists stripe_subscription_id text;
alter table workspaces add column if not exists current_period_end timestamptz;
alter table workspaces add column if not exists trial_ends_at timestamptz;
alter table workspaces add column if not exists founder boolean not null default false;
create unique index if not exists workspaces_stripe_customer_key on workspaces (stripe_customer_id) where stripe_customer_id is not null;

-- Els workspaces que ja existien: 30 dies de prova perquè res es talli de cop.
update workspaces set trial_ends_at = now() + interval '30 days' where trial_ends_at is null and plan = 'free';
-- El workspace original (el de la casa) va sense cost.
update workspaces set plan = 'agencia_xl', plan_status = 'comped' where id = 'ws_legacy';

-- Esdeveniments de Stripe ja processats (idempotència del webhook).
create table if not exists billing_events (
  id text primary key,
  type text not null,
  created_at timestamptz not null default now()
);
