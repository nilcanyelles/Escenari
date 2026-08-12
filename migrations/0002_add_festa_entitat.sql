-- Afegeix el camp "Festa/entitat" als concerts (nom de la festa major o entitat organitzadora).
alter table concerts add column if not exists festa_entitat text not null default '';
