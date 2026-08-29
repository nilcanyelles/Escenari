-- Percentatge fix de la comissió de l'agència d'aquest concert: es manté
-- fix encara que canviïn les despeses o el caixet (només varia l'import en
-- €, derivat d'aquest % i del caixet net/brut vigent).
alter table concerts add column if not exists agency_pct real not null default 20;
