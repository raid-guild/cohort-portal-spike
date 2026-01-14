create table if not exists public.profiles (
  user_id uuid unique,
  handle text primary key,
  display_name text not null,
  bio text,
  avatar_url text,
  wallet_address text,
  email text,
  links jsonb,
  cohorts jsonb,
  skills text[],
  roles text[],
  location text,
  contact jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "Public profiles are viewable"
on public.profiles
for select
using (true);

create policy "Users can create their profile"
on public.profiles
for insert
with check (auth.uid() = user_id);

create policy "Users can update their profile"
on public.profiles
for update
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id)
do update set public = true;

create table if not exists public.role_catalog (
  role text primary key,
  type text,
  description text,
  category text
);

create table if not exists public.skill_catalog (
  skill text primary key,
  category text
);

create table if not exists public.user_roles (
  user_id uuid not null,
  role text not null,
  created_at timestamptz default now(),
  primary key (user_id, role)
);

alter table public.user_roles enable row level security;

create policy "Users can read their roles"
on public.user_roles
for select
using (auth.uid() = user_id);

create table if not exists public.modules (
  id text primary key,
  title text not null,
  description text,
  lane text,
  type text,
  url text,
  status text,
  owner jsonb,
  requires_auth boolean,
  tags text[],
  surfaces text[],
  updated_at timestamptz default now()
);

alter table public.modules enable row level security;

create policy "Modules are viewable"
on public.modules
for select
using (true);

create table if not exists public.module_keys (
  module_id text primary key,
  key_hash text not null,
  created_at timestamptz default now()
);

alter table public.module_keys enable row level security;

create table if not exists public.module_data (
  module_id text not null,
  user_id uuid not null,
  visibility text not null default 'private',
  payload jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (module_id, user_id)
);

create or replace function public.set_module_data_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_module_data_updated_at on public.module_data;
create trigger set_module_data_updated_at
before update on public.module_data
for each row execute function public.set_module_data_updated_at();

alter table public.module_data enable row level security;

create policy "Module data public read"
on public.module_data
for select
using (visibility = 'public');

create policy "Module data authenticated read"
on public.module_data
for select
using (visibility = 'authenticated' and auth.role() = 'authenticated');

create policy "Module data private read"
on public.module_data
for select
using (visibility = 'private' and auth.uid() = user_id);

create policy "Module data admin read"
on public.module_data
for select
using (visibility = 'admin' and (auth.jwt() ->> 'role') = 'admin');

create policy "Users can write their module data"
on public.module_data
for insert
with check (auth.uid() = user_id);

create policy "Users can update their module data"
on public.module_data
for update
using (auth.uid() = user_id);

create extension if not exists "pgcrypto";

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  audience text not null default 'public'
    check (audience in ('public', 'authenticated', 'host')),
  role_targets text[],
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists set_announcements_updated_at on public.announcements;
create trigger set_announcements_updated_at
before update on public.announcements
for each row execute function public.set_updated_at();

alter table public.announcements enable row level security;
