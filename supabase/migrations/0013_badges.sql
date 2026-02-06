-- Badges + achievements (public display, service-role writes)

-- Storage bucket for module assets (public read)
insert into storage.buckets (id, name, public)
values ('modules', 'modules', true)
on conflict (id)
do update set public = true;

create table if not exists public.badge_definitions (
  id text primary key,
  title text not null,
  description text,
  image_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_badge_definitions_updated_at on public.badge_definitions;
create trigger set_badge_definitions_updated_at
before update on public.badge_definitions
for each row execute function public.set_updated_at();

alter table public.badge_definitions enable row level security;

-- Public read so profiles can show badges without auth.
create policy "Badge definitions are viewable"
on public.badge_definitions
for select
using (true);

create table if not exists public.user_badges (
  user_id uuid not null,
  badge_id text not null references public.badge_definitions (id) on delete cascade,
  awarded_at timestamptz not null default now(),
  awarded_by uuid,
  note text,
  metadata jsonb,
  primary key (user_id, badge_id)
);

alter table public.user_badges enable row level security;

-- Public read so badges can render on public profile pages.
create policy "User badges are viewable"
on public.user_badges
for select
using (true);

-- Note: no insert/update/delete policies by design.
-- Writes should go through Next.js API routes using the Supabase service role.
