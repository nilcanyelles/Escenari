-- Contacte principal d'aquest concert en concret (organitzador/promotor):
-- correu, nom, telèfon, empresa — a la pestanya "Informació general",
-- diferent dels contactes del full de ruta.
alter table concerts add column if not exists contact jsonb not null default '{}'::jsonb;
