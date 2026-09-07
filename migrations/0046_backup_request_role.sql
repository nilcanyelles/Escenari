-- Càrrec buscat quan la cerca de suplent és per a algú de la crew (no
-- músic) — paral·lel a "instruments", que és el que ja s'utilitzava per als
-- músics. Una cerca fa servir l'un o l'altre, mai tots dos.
alter table backup_requests add column if not exists role text not null default '';
