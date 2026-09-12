-- Abast fi de l'enllaç del formulari de regidor: quines seccions es poden
-- veure/omplir (informació general, el lloc, contactes, horaris,
-- hospitalitat, detalls tècnics) en lloc del vell "info"/"ruta"/"both".
-- "scope" es queda (per compatibilitat/constraint), però "sections" és
-- l'origen de veritat des d'ara.
alter table share_links add column if not exists sections jsonb;
alter table share_links add column if not exists is_default boolean not null default false;

update share_links set sections = case scope
  when 'info' then '["info"]'::jsonb
  when 'ruta' then '["lloc","contacts","schedule","hospitalitat","tecnic"]'::jsonb
  else '["info","lloc","contacts","schedule","hospitalitat","tecnic"]'::jsonb
end
where sections is null;

-- El primer enllaç (per data) de cada concert amb abast complet és el
-- "per defecte" (el que crea autoCreateShareLinkForConcert) — la resta
-- d'enllaços que ja hi hagués es queden com a addicionals.
update share_links set is_default = true where id in (
  select distinct on (concert_id) id from share_links
  where scope = 'both'
  order by concert_id, created_at asc
);
