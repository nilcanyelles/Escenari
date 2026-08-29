-- Percentatges de repartiment del caixet predeterminats per grup (nom -> %),
-- aplicats als concerts que encara no tinguin cap repartiment desat.
alter table bands add column if not exists default_payout_split jsonb not null default '{}'::jsonb;
