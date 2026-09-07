-- Tipus d'entrada del concert: gratuïta o de pagament — a "Informació
-- general", al costat de "Es pot anunciar?".
alter table concerts add column if not exists ticket_type text not null default 'gratuit';
