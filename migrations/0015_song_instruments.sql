-- Instruments que sonen a cada canco i partitures etiquetades per instrument.
alter table songs add column if not exists instruments jsonb not null default '[]'::jsonb;
alter table files add column if not exists instrument text not null default '';
