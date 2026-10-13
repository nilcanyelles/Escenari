-- Nom opcional del tercer (promotor, sala...) quan paid_by='altre' —
-- permet dir qui és "tercers" en comptes de només marcar-ho.
alter table transactions add column if not exists payer_third_party text not null default '';
