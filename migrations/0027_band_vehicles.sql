-- Vehicles del grup (nom + matrícula), per triar-los ràpid a "Matrícules
-- autoritzades" del full de ruta en comptes d'escriure-les a mà cada cop.
alter table bands add column if not exists vehicles jsonb not null default '[]'::jsonb;
