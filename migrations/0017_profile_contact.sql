-- Contacte propi al perfil de persona: telèfon, WhatsApp (pot ser diferent)
-- i etiqueta de rol (p. ex. "Mànager" per al gestor dins l'equip tècnic).
alter table person_profiles add column if not exists phone text not null default '';
alter table person_profiles add column if not exists whatsapp text not null default '';
alter table person_profiles add column if not exists role_label text not null default '';
