-- Arcane Exchange (internal marketplace / looking-for board)

create table if not exists public.looking_for_listings (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  constraint looking_for_listings_type_check check (type in ('looking_for', 'offering')),
  title text not null,
  description text not null default '',
  category text,
  tags text[],
  status text not null default 'open',
  constraint looking_for_listings_status_check check (status in ('open', 'fulfilled', 'closed')),
  created_by uuid not null,
  contact_method text not null default 'profile',
  constraint looking_for_listings_contact_method_check check (contact_method in ('profile', 'dm', 'external')),
  external_contact text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fulfilled_at timestamptz
);

drop trigger if exists set_looking_for_listings_updated_at on public.looking_for_listings;
create trigger set_looking_for_listings_updated_at
before update on public.looking_for_listings
for each row execute function public.set_updated_at();

create index if not exists looking_for_listings_status_idx on public.looking_for_listings (status);
create index if not exists looking_for_listings_type_idx on public.looking_for_listings (type);
create index if not exists looking_for_listings_category_idx on public.looking_for_listings (category);
create index if not exists looking_for_listings_created_by_idx on public.looking_for_listings (created_by);
create index if not exists looking_for_listings_tags_gin_idx on public.looking_for_listings using gin (tags);

alter table public.looking_for_listings enable row level security;

-- v1 access is via Next.js API routes (service role). Provide read access to authenticated users.
create policy "Authenticated can view arcane exchange listings"
on public.looking_for_listings
for select
using (auth.role() = 'authenticated');
