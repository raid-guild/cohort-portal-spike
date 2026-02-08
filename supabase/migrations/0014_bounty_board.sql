-- Bounty board (host managed; authenticated browsing/claiming via API routes)

create table if not exists public.bounties (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  status text not null default 'open',
  constraint bounties_status_check check (status in ('open', 'claimed', 'submitted', 'accepted', 'closed')),
  github_url text,
  reward_type text not null default 'none',
  reward_amount numeric,
  reward_token text,
  badge_id text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  due_at timestamptz,
  tags text[]
);

drop trigger if exists set_bounties_updated_at on public.bounties;
create trigger set_bounties_updated_at
before update on public.bounties
for each row execute function public.set_updated_at();

create table if not exists public.bounty_claims (
  id uuid primary key default gen_random_uuid(),
  bounty_id uuid not null references public.bounties (id) on delete cascade,
  user_id uuid not null,
  status text not null default 'claimed',
  constraint bounty_claims_status_check check (status in ('claimed', 'submitted', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  resolved_at timestamptz
);

drop trigger if exists set_bounty_claims_updated_at on public.bounty_claims;
create trigger set_bounty_claims_updated_at
before update on public.bounty_claims
for each row execute function public.set_updated_at();

-- One active claim per bounty.
create unique index if not exists bounty_claims_one_active_per_bounty
on public.bounty_claims (bounty_id)
where status in ('claimed', 'submitted');

create table if not exists public.bounty_comments (
  id uuid primary key default gen_random_uuid(),
  bounty_id uuid not null references public.bounties (id) on delete cascade,
  user_id uuid not null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.bounties enable row level security;
alter table public.bounty_claims enable row level security;
alter table public.bounty_comments enable row level security;

-- v1 access is via Next.js API routes (service role). Provide read access to authenticated users.
create policy "Authenticated can view bounties"
on public.bounties
for select
using (auth.role() = 'authenticated');

create policy "Authenticated can view bounty claims"
on public.bounty_claims
for select
using (auth.role() = 'authenticated');

create policy "Authenticated can view bounty comments"
on public.bounty_comments
for select
using (auth.role() = 'authenticated');
