-- Nom escrit al camp de suplent (substitutes) confirmat de veres: escriure-hi
-- un nom ja no compta sol com a resolt, cal marcar-lo amb el tick.
alter table concerts add column if not exists substitute_confirmed jsonb not null default '{}'::jsonb;
