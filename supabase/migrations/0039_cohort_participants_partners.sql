create table if not exists public.cohort_participants (
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text,
  status text not null default 'active' check (status in ('active', 'alumni', 'inactive')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (cohort_id, user_id)
);

create table if not exists public.cohort_partners (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  name text not null,
  logo_url text,
  description text not null default '',
  website_url text,
  crm_account_id uuid references public.relationship_crm_accounts(id) on delete set null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_cohort_participants_updated_at on public.cohort_participants;
create trigger set_cohort_participants_updated_at
before update on public.cohort_participants
for each row execute function public.set_updated_at();

drop trigger if exists set_cohort_partners_updated_at on public.cohort_partners;
create trigger set_cohort_partners_updated_at
before update on public.cohort_partners
for each row execute function public.set_updated_at();

create index if not exists cohort_participants_user_idx
  on public.cohort_participants (user_id);
create index if not exists cohort_participants_sort_idx
  on public.cohort_participants (cohort_id, sort_order, created_at);
create index if not exists cohort_partners_cohort_display_idx
  on public.cohort_partners (cohort_id, display_order, created_at);
create index if not exists cohort_partners_crm_account_idx
  on public.cohort_partners (crm_account_id);

create or replace function public.has_cohort_hub_access(p_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_user_id
      and ur.role in ('host', 'admin')
  )
  or exists (
    select 1
    from public.entitlements e
    where e.user_id = p_user_id
      and e.entitlement = 'cohort-access'
      and e.status = 'active'
      and (e.expires_at is null or e.expires_at > now())
  );
$$;

create or replace function public.has_cohort_hub_manage_access(p_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_user_id
      and ur.role in ('host', 'admin')
  );
$$;

alter table public.cohort_participants enable row level security;
alter table public.cohort_partners enable row level security;

create policy "cohort participants readable by cohort-access or host"
on public.cohort_participants
for select
using (
  auth.uid() is not null
  and public.has_cohort_hub_access(auth.uid())
);

create policy "cohort participants writable by host"
on public.cohort_participants
for all
using (
  auth.uid() is not null
  and public.has_cohort_hub_manage_access(auth.uid())
)
with check (
  auth.uid() is not null
  and public.has_cohort_hub_manage_access(auth.uid())
);

create policy "cohort partners readable by cohort-access or host"
on public.cohort_partners
for select
using (
  auth.uid() is not null
  and public.has_cohort_hub_access(auth.uid())
);

create policy "cohort partners writable by host"
on public.cohort_partners
for all
using (
  auth.uid() is not null
  and public.has_cohort_hub_manage_access(auth.uid())
)
with check (
  auth.uid() is not null
  and public.has_cohort_hub_manage_access(auth.uid())
);
