-- Raid Showcase (proof-of-work feed)

create table if not exists public.showcase_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  image_url text not null,
  title varchar(100) not null,
  impact_statement text not null,
  boost_count int4 not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint showcase_posts_title_length check (char_length(title) <= 100),
  constraint showcase_posts_impact_length check (char_length(impact_statement) <= 280)
);

create index if not exists idx_showcase_posts_created_at on public.showcase_posts (created_at desc);
create index if not exists idx_showcase_posts_user_id on public.showcase_posts (user_id);

drop trigger if exists set_showcase_posts_updated_at on public.showcase_posts;
create trigger set_showcase_posts_updated_at
before update on public.showcase_posts
for each row execute function public.set_updated_at();

alter table public.showcase_posts enable row level security;

-- Public read so home/people/profile surfaces can render without requiring auth.
create policy "Showcase posts are viewable"
on public.showcase_posts
for select
using (true);

-- Writes should go through Next.js API routes using the Supabase service role.
