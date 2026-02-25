create or replace function public.has_relationship_crm_access(p_user_id uuid)
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
      and e.entitlement = 'dao-member'
      and e.status = 'active'
      and (e.expires_at is null or e.expires_at > now())
  );
$$;

create table if not exists public.relationship_crm_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  relationship_type text not null check (relationship_type in ('sponsor', 'agency-client', 'partner', 'other')),
  stage text not null check (stage in ('lead', 'qualified', 'proposal', 'negotiation', 'active', 'paused', 'closed-won', 'closed-lost')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  owner_user_id uuid not null,
  next_follow_up_at timestamptz,
  notes text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.relationship_crm_contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.relationship_crm_accounts(id) on delete cascade,
  full_name text not null,
  role_title text,
  email text,
  phone text,
  preferred_channel text check (preferred_channel in ('email', 'discord', 'telegram', 'phone', 'other')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.relationship_crm_interactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.relationship_crm_accounts(id) on delete cascade,
  contact_id uuid references public.relationship_crm_contacts(id) on delete set null,
  interaction_type text not null check (interaction_type in ('note', 'email', 'call', 'meeting', 'other')),
  summary text not null,
  interaction_at timestamptz not null,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists public.relationship_crm_tasks (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.relationship_crm_accounts(id) on delete cascade,
  assignee_user_id uuid not null,
  title text not null,
  due_at timestamptz,
  status text not null default 'open' check (status in ('open', 'done', 'canceled')),
  created_by uuid not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_relationship_crm_accounts_updated_at on public.relationship_crm_accounts;
create trigger set_relationship_crm_accounts_updated_at
before update on public.relationship_crm_accounts
for each row execute function public.set_updated_at();

drop trigger if exists set_relationship_crm_contacts_updated_at on public.relationship_crm_contacts;
create trigger set_relationship_crm_contacts_updated_at
before update on public.relationship_crm_contacts
for each row execute function public.set_updated_at();

drop trigger if exists set_relationship_crm_tasks_updated_at on public.relationship_crm_tasks;
create trigger set_relationship_crm_tasks_updated_at
before update on public.relationship_crm_tasks
for each row execute function public.set_updated_at();

create index if not exists relationship_crm_accounts_status_idx
  on public.relationship_crm_accounts (status)
  where deleted_at is null;
create index if not exists relationship_crm_accounts_stage_idx
  on public.relationship_crm_accounts (stage)
  where deleted_at is null;
create index if not exists relationship_crm_accounts_owner_idx
  on public.relationship_crm_accounts (owner_user_id)
  where deleted_at is null;
create index if not exists relationship_crm_accounts_follow_up_idx
  on public.relationship_crm_accounts (next_follow_up_at)
  where deleted_at is null;

create index if not exists relationship_crm_contacts_account_idx
  on public.relationship_crm_contacts (account_id);
create index if not exists relationship_crm_interactions_account_interaction_at_idx
  on public.relationship_crm_interactions (account_id, interaction_at desc);
create index if not exists relationship_crm_tasks_account_status_due_idx
  on public.relationship_crm_tasks (account_id, status, due_at);
create index if not exists relationship_crm_tasks_due_open_idx
  on public.relationship_crm_tasks (due_at)
  where status = 'open';

alter table public.relationship_crm_accounts enable row level security;
alter table public.relationship_crm_contacts enable row level security;
alter table public.relationship_crm_interactions enable row level security;
alter table public.relationship_crm_tasks enable row level security;

create policy "CRM accounts readable by host or dao-member"
on public.relationship_crm_accounts
for select
using (
  auth.uid() is not null
  and public.has_relationship_crm_access(auth.uid())
  and deleted_at is null
);

create policy "CRM accounts insertable by host or dao-member"
on public.relationship_crm_accounts
for insert
with check (
  auth.uid() is not null
  and public.has_relationship_crm_access(auth.uid())
);

create policy "CRM accounts updatable by host or dao-member"
on public.relationship_crm_accounts
for update
using (
  auth.uid() is not null
  and public.has_relationship_crm_access(auth.uid())
)
with check (
  auth.uid() is not null
  and public.has_relationship_crm_access(auth.uid())
);

create policy "CRM accounts deletable by host or dao-member"
on public.relationship_crm_accounts
for delete
using (
  auth.uid() is not null
  and public.has_relationship_crm_access(auth.uid())
);

create policy "CRM contacts readable by host or dao-member"
on public.relationship_crm_contacts
for select
using (
  auth.uid() is not null
  and public.has_relationship_crm_access(auth.uid())
  and exists (
    select 1
    from public.relationship_crm_accounts a
    where a.id = relationship_crm_contacts.account_id
      and a.deleted_at is null
  )
);

create policy "CRM contacts insertable by host or dao-member"
on public.relationship_crm_contacts
for insert
with check (
  auth.uid() is not null
  and public.has_relationship_crm_access(auth.uid())
  and exists (
    select 1
    from public.relationship_crm_accounts a
    where a.id = relationship_crm_contacts.account_id
      and a.deleted_at is null
  )
);

create policy "CRM contacts updatable by host or dao-member"
on public.relationship_crm_contacts
for update
using (
  auth.uid() is not null
  and public.has_relationship_crm_access(auth.uid())
  and exists (
    select 1
    from public.relationship_crm_accounts a
    where a.id = relationship_crm_contacts.account_id
      and a.deleted_at is null
  )
)
with check (
  auth.uid() is not null
  and public.has_relationship_crm_access(auth.uid())
  and exists (
    select 1
    from public.relationship_crm_accounts a
    where a.id = relationship_crm_contacts.account_id
      and a.deleted_at is null
  )
);

create policy "CRM contacts deletable by host or dao-member"
on public.relationship_crm_contacts
for delete
using (
  auth.uid() is not null
  and public.has_relationship_crm_access(auth.uid())
  and exists (
    select 1
    from public.relationship_crm_accounts a
    where a.id = relationship_crm_contacts.account_id
      and a.deleted_at is null
  )
);

create policy "CRM interactions readable by host or dao-member"
on public.relationship_crm_interactions
for select
using (
  auth.uid() is not null
  and public.has_relationship_crm_access(auth.uid())
  and exists (
    select 1
    from public.relationship_crm_accounts a
    where a.id = relationship_crm_interactions.account_id
      and a.deleted_at is null
  )
);

create policy "CRM interactions insertable by host or dao-member"
on public.relationship_crm_interactions
for insert
with check (
  auth.uid() is not null
  and public.has_relationship_crm_access(auth.uid())
  and exists (
    select 1
    from public.relationship_crm_accounts a
    where a.id = relationship_crm_interactions.account_id
      and a.deleted_at is null
  )
);

create policy "CRM interactions updatable by host or dao-member"
on public.relationship_crm_interactions
for update
using (
  auth.uid() is not null
  and public.has_relationship_crm_access(auth.uid())
  and exists (
    select 1
    from public.relationship_crm_accounts a
    where a.id = relationship_crm_interactions.account_id
      and a.deleted_at is null
  )
)
with check (
  auth.uid() is not null
  and public.has_relationship_crm_access(auth.uid())
  and exists (
    select 1
    from public.relationship_crm_accounts a
    where a.id = relationship_crm_interactions.account_id
      and a.deleted_at is null
  )
);

create policy "CRM interactions deletable by host or dao-member"
on public.relationship_crm_interactions
for delete
using (
  auth.uid() is not null
  and public.has_relationship_crm_access(auth.uid())
  and exists (
    select 1
    from public.relationship_crm_accounts a
    where a.id = relationship_crm_interactions.account_id
      and a.deleted_at is null
  )
);

create policy "CRM tasks readable by host or dao-member"
on public.relationship_crm_tasks
for select
using (
  auth.uid() is not null
  and public.has_relationship_crm_access(auth.uid())
  and exists (
    select 1
    from public.relationship_crm_accounts a
    where a.id = relationship_crm_tasks.account_id
      and a.deleted_at is null
  )
);

create policy "CRM tasks insertable by host or dao-member"
on public.relationship_crm_tasks
for insert
with check (
  auth.uid() is not null
  and public.has_relationship_crm_access(auth.uid())
  and exists (
    select 1
    from public.relationship_crm_accounts a
    where a.id = relationship_crm_tasks.account_id
      and a.deleted_at is null
  )
);

create policy "CRM tasks updatable by host or dao-member"
on public.relationship_crm_tasks
for update
using (
  auth.uid() is not null
  and public.has_relationship_crm_access(auth.uid())
  and exists (
    select 1
    from public.relationship_crm_accounts a
    where a.id = relationship_crm_tasks.account_id
      and a.deleted_at is null
  )
)
with check (
  auth.uid() is not null
  and public.has_relationship_crm_access(auth.uid())
  and exists (
    select 1
    from public.relationship_crm_accounts a
    where a.id = relationship_crm_tasks.account_id
      and a.deleted_at is null
  )
);

create policy "CRM tasks deletable by host or dao-member"
on public.relationship_crm_tasks
for delete
using (
  auth.uid() is not null
  and public.has_relationship_crm_access(auth.uid())
  and exists (
    select 1
    from public.relationship_crm_accounts a
    where a.id = relationship_crm_tasks.account_id
      and a.deleted_at is null
  )
);
