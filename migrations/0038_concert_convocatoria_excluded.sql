-- Membres exclosos de la convocatòria d'un concert (name -> true): no
-- s'eliminen del grup, només es desactiven visualment i queden fora del
-- recompte de la capçalera per a aquest concert en concret.
alter table concerts add column if not exists convocatoria_excluded jsonb not null default '{}'::jsonb;
