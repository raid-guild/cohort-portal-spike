create table if not exists public.dao_memberships (
  id uuid primary key default gen_random_uuid(),
  dao_id text not null,
  chain_id text not null,
  wallet_address text not null,
  constraint dao_memberships_wallet_address_lowercase_check
    check (wallet_address = lower(wallet_address)),
  user_id uuid,
  profile_handle text references public.profiles (handle) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'pending', 'revoked')),
  shares numeric(78, 0) not null default 0,
  loot numeric(78, 0) not null default 0,
  voting_power numeric(78, 0) not null default 0,
  source jsonb not null default '{}'::jsonb,
  verification jsonb not null default '{}'::jsonb,
  raw jsonb,
  first_seen_at timestamptz not null default now(),
  claimed_at timestamptz,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_dao_memberships_updated_at on public.dao_memberships;
create trigger set_dao_memberships_updated_at
before update on public.dao_memberships
for each row execute function public.set_updated_at();

create unique index if not exists dao_memberships_dao_chain_wallet_unique_idx
  on public.dao_memberships (dao_id, chain_id, wallet_address);

create index if not exists dao_memberships_user_id_idx
  on public.dao_memberships (user_id);

create index if not exists dao_memberships_status_idx
  on public.dao_memberships (status, dao_id, chain_id);

alter table public.dao_memberships enable row level security;

create policy "Users can read their dao memberships"
on public.dao_memberships
for select
using (auth.uid() = user_id);
