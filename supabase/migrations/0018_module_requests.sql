-- Module Requests (idea intake + voting)

create table if not exists public.module_requests (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete cascade,
  module_id text not null,
  title text not null,
  owner_contact text null,
  status text not null default 'draft',
  spec jsonb not null default '{}'::jsonb,
  votes_count int4 not null default 0,
  promotion_threshold int4 not null default 10,
  github_issue_url text null,
  submitted_to_github_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint module_requests_status_allowed check (
    status in ('draft', 'open', 'ready', 'submitted_to_github', 'archived')
  )
);

create index if not exists idx_module_requests_status_updated_at
  on public.module_requests (status, updated_at desc);

create index if not exists idx_module_requests_created_by_created_at
  on public.module_requests (created_by, created_at desc);

create table if not exists public.module_request_votes (
  request_id uuid not null references public.module_requests (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);

create index if not exists idx_module_request_votes_request_id
  on public.module_request_votes (request_id);

create index if not exists idx_module_request_votes_user_id
  on public.module_request_votes (user_id);

drop trigger if exists set_module_requests_updated_at on public.module_requests;
create trigger set_module_requests_updated_at
before update on public.module_requests
for each row execute function public.set_updated_at();

-- Keep module_requests.votes_count in sync.
create or replace function public.module_requests_update_votes_count()
returns trigger
language plpgsql
security definer
as $$
declare
  target_request_id uuid;
  new_count int4;
  threshold int4;
  current_status text;
begin
  target_request_id := coalesce(new.request_id, old.request_id);

  select count(*)::int4 into new_count
  from public.module_request_votes v
  where v.request_id = target_request_id;

  update public.module_requests r
    set votes_count = new_count
  where r.id = target_request_id;

  -- Auto-promote open requests to ready when threshold reached.
  select r.promotion_threshold, r.status
    into threshold, current_status
  from public.module_requests r
  where r.id = target_request_id;

  if current_status = 'open' and new_count >= threshold then
    update public.module_requests
      set status = 'ready'
    where id = target_request_id;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_module_requests_votes_count_insert on public.module_request_votes;
drop trigger if exists trg_module_requests_votes_count_delete on public.module_request_votes;

create trigger trg_module_requests_votes_count_insert
after insert on public.module_request_votes
for each row execute function public.module_requests_update_votes_count();

create trigger trg_module_requests_votes_count_delete
after delete on public.module_request_votes
for each row execute function public.module_requests_update_votes_count();

alter table public.module_requests enable row level security;
alter table public.module_request_votes enable row level security;

-- Reads
create policy "Authenticated users can view open/ready module requests"
on public.module_requests
for select
to authenticated
using (
  deleted_at is null
  and status in ('open', 'ready')
);

create policy "Creators can view their own module requests"
on public.module_requests
for select
to authenticated
using (
  deleted_at is null
  and created_by = auth.uid()
);

-- Writes
create policy "Authenticated users can create module requests"
on public.module_requests
for insert
to authenticated
with check (created_by = auth.uid());

create policy "Creators can update their draft module requests"
on public.module_requests
for update
to authenticated
using (created_by = auth.uid() and status = 'draft' and deleted_at is null)
with check (created_by = auth.uid() and deleted_at is null);

-- Votes
create policy "Authenticated users can view votes"
on public.module_request_votes
for select
to authenticated
using (true);

create policy "Authenticated users can vote on open/ready requests"
on public.module_request_votes
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.module_requests r
    where r.id = request_id
      and r.deleted_at is null
      and r.status in ('open', 'ready')
  )
);

create policy "Authenticated users can unvote their vote"
on public.module_request_votes
for delete
to authenticated
using (user_id = auth.uid());

-- Note: host/admin promotion and archived/submitted transitions should happen via
-- Next.js API routes using the Supabase service role.
