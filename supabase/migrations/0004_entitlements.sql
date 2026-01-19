create table if not exists public.entitlements (
  user_id uuid not null,
  entitlement text not null,
  status text not null default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (user_id, entitlement)
);

drop trigger if exists set_entitlements_updated_at on public.entitlements;
create trigger set_entitlements_updated_at
before update on public.entitlements
for each row execute function public.set_updated_at();

alter table public.entitlements enable row level security;

create policy "Users can read their entitlements"
on public.entitlements
for select
using (auth.uid() = user_id);
