-- Contracte d'actuació per concert: clàusules editables (jsonb) i enllaç
-- públic (/ct/token) per enviar-lo al client.
alter table concerts add column if not exists contract jsonb;
alter table concerts add column if not exists contract_token text;
create unique index if not exists concerts_contract_token_key on concerts (contract_token) where contract_token is not null;
