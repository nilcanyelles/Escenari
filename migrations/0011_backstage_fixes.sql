-- Correccions "backstage": estat reservat, factures amb IRPF/IVA per línia i
-- cadena de hash (preparades per a Verifactu), bestretes, rebuts de despeses,
-- visibilitat del caixet per als membres i feeds iCal personals.

-- Estat "reservat" (opció/pencil hold) entre pendent i confirmat.
alter table concerts drop constraint if exists concerts_status_check;
alter table concerts add constraint concerts_status_check
  check (status in ('confirmat', 'pendent', 'reservat', 'cancel·lat'));

-- Factures: base + tipus d'IVA i retenció d'IRPF per factura, bestreta,
-- i cadena de hash per poder afegir Verifactu sense migració.
alter table invoices add column if not exists base_amount integer not null default 0;
alter table invoices add column if not exists iva_rate numeric(5,2) not null default 21;
alter table invoices add column if not exists irpf_rate numeric(5,2) not null default 0;
alter table invoices add column if not exists deposit_amount integer not null default 0;
alter table invoices add column if not exists deposit_paid boolean not null default false;
alter table invoices add column if not exists prev_hash text not null default '';
alter table invoices add column if not exists hash text not null default '';
update invoices set base_amount = round(amount / 1.21) where base_amount = 0 and amount > 0;

-- Tipus per defecte del workspace (IVA 21, IRPF 15/7/0 segons el cas).
alter table company_info add column if not exists iva_rate numeric(5,2) not null default 21;
alter table company_info add column if not exists irpf_rate numeric(5,2) not null default 0;

-- Rebut (foto/PDF) adjunt a un moviment econòmic.
alter table transactions add column if not exists receipt_file_id text references files(id) on delete set null;

-- El gestor tria si els membres del grup veuen el caixet dels bolos.
alter table bands add column if not exists show_fees boolean not null default false;

-- Feed iCal personal per a cada usuari (gestor o artista).
alter table profiles add column if not exists feed_token text;
update profiles set feed_token = 'u_' || md5(random()::text || clerk_user_id) where feed_token is null;
create unique index if not exists profiles_feed_token_key on profiles (feed_token);
