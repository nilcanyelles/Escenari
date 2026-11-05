alter table profiles add column if not exists username text;
create unique index if not exists profiles_username_key on profiles (lower(username)) where username is not null;
