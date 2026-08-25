-- El codi d'invitació ja no es mostra automàticament ni és vàlid per defecte:
-- el gestor l'ha d'activar explícitament des del botó de compartir, i el pot
-- bloquejar un cop tothom s'hagi unit. join_code es manté NOT NULL (per l'índex
-- únic existent) però només compta si join_code_active és cert.
alter table bands add column if not exists join_code_active boolean not null default false;
