-- Si l'agència assumeix les despeses del bolo (el seu % es calcula sobre el
-- caixet net) o no (es calcula sobre el caixet brut i les despeses les
-- absorbeix només la resta del repartiment). Per defecte true, mantenint el
-- comportament que ja hi havia.
alter table concerts add column if not exists agency_assumes_expenses boolean not null default true;
