-- Registre unificat de contactes: músics/crew dels grups, contactes que
-- apareixen a un full de ruta (tècnics, promotors...), i empreses que s'han
-- facturat. Es desduplica pel nom (case-insensitive): si el mateix nom ja
-- existeix, només s'omplen els camps que encara estan buits, per no
-- trepitjar una edició manual feta directament a la pestanya de Contactes.

create table if not exists contacts (
  id text primary key,
  name text not null,
  kinds jsonb not null default '[]'::jsonb,
  role text not null default '',
  phone text not null default '',
  email text not null default '',
  company text not null default '',
  cif text not null default '',
  address text not null default '',
  iban text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists contacts_name_lower_key on contacts (lower(name));

drop trigger if exists contacts_set_updated_at on contacts;
create trigger contacts_set_updated_at before update on contacts
  for each row execute function set_updated_at();
