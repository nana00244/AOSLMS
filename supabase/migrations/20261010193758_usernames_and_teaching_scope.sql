-- Existing email accounts keep working. Username accounts use reserved Auth aliases.
alter table public.profiles add column username text;
alter table public.profiles add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9][a-z0-9._-]{2,31}$');
create unique index profiles_username_unique on public.profiles(username) where username is not null;
