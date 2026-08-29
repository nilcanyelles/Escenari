-- Plantilla d'"opcions" del full de ruta (etiquetes, fases, càrrecs i
-- interruptors sí/no) que un grup pot desar per secció, sense detalls ni
-- enllaços concrets. S'aplica en inicialitzar el full de ruta de concerts
-- nous d'aquest grup.
alter table bands add column if not exists default_route_sheet jsonb;
