-- Any en actiu del grup, editable des de la pàgina de compartir grup — si
-- no s'ha escrit mai, es segueix calculant sol a partir del primer concert
-- (vegeu getBandPublicData), pensat per a grups que fa anys que existeixen
-- però que fa poc que porten els concerts a Escenari.
alter table bands add column if not exists active_since text;
