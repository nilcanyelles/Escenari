-- Qui es fa càrrec de cada despesa d'un concert: 'agencia' (surt de la seva
-- comissió), 'grup' (del repartiment de músics i crew), 'ambdos' (del caixet
-- abans de calcular res) o 'altre' (la paga algú altre: promotor, sala...).
-- Buit = despesa d'abans d'existir aquest camp: segueix el criteri antic del
-- concert (agency_assumes_expenses).
alter table transactions add column if not exists paid_by text not null default '';
