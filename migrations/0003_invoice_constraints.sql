-- Facturació: garanties d'integritat.
-- Comprovat sobre les dades existents abans d'escriure la migració: cap
-- concert_id nul ni duplicat a invoices.

-- Cada factura pertany sempre a un concert.
alter table invoices alter column concert_id set not null;

-- Una factura per concert (la UI ja ho assumia; ara la BD ho garanteix).
drop index if exists invoices_concert_id_idx;
create unique index if not exists invoices_concert_id_key on invoices (concert_id);

-- La numeració seqüencial busca el màxim de la sèrie anual amb LIKE 'F-YYYY-%';
-- índex de patró perquè continuï sent una cerca d'índex quan creixi la taula.
create index if not exists invoices_id_pattern_idx on invoices (id text_pattern_ops);
