-- "Es pot anunciar?" i "Tipus d'entrada" admeten un tercer estat (encara
-- sense decidir) — per defecte cap dels dos ja no ve pre-sel·leccionat, i
-- es pot tornar a aquest estat des de la UI. Es reinicia a "sense decidir"
-- qualsevol concert que encara tingués el valor per defecte antic (mai
-- triat de veres per ningú); es conserva el valor de qualsevol que ja
-- s'hagués canviat explícitament a l'altra opció.
alter table concerts alter column can_announce drop default;
alter table concerts alter column can_announce type text using (case when can_announce is false then 'no' else '' end);
alter table concerts alter column can_announce set default '';
alter table concerts alter column can_announce set not null;

alter table concerts alter column ticket_type set default '';
update concerts set ticket_type = '' where ticket_type = 'gratuit';
