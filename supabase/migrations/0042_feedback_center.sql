create or replace function public.has_feedback_center_triage_access(p_user_id uuid)
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

create table if not exists public.feedback_items (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('bug', 'feature', 'feedback', 'module_request')),
  title text not null,
  description_md text not null,
  steps_to_reproduce_md text,
  expected_result_md text,
  actual_result_md text,
  problem_md text,
  proposed_outcome_md text,
  status text not null default 'new' check (status in ('new', 'triaged', 'in_progress', 'done', 'closed')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  module_id text,
  route_path text,
  reporter_user_id uuid not null,
  assignee_user_id uuid,
  triage_notes text,
  browser_meta jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint feedback_items_bug_fields_required check (
    type <> 'bug'
    or (
      steps_to_reproduce_md is not null
      and expected_result_md is not null
      and actual_result_md is not null
    )
  ),
  constraint feedback_items_feature_problem_required check (
    type not in ('feature', 'module_request')
    or (
      problem_md is not null
      and proposed_outcome_md is not null
    )
  )
);

drop trigger if exists set_feedback_items_updated_at on public.feedback_items;
create trigger set_feedback_items_updated_at
before update on public.feedback_items
for each row execute function public.set_updated_at();

create index if not exists feedback_items_reporter_created_idx
  on public.feedback_items (reporter_user_id, created_at desc);

create index if not exists feedback_items_status_priority_created_idx
  on public.feedback_items (status, priority, created_at desc);

create index if not exists feedback_items_type_created_idx
  on public.feedback_items (type, created_at desc);

alter table public.feedback_items enable row level security;

create policy "Feedback items readable by reporter or host"
on public.feedback_items
for select
using (
  auth.uid() is not null
  and (
    reporter_user_id = auth.uid()
    or public.has_feedback_center_triage_access(auth.uid())
  )
);

create policy "Feedback items insertable by reporter"
on public.feedback_items
for insert
with check (
  auth.uid() is not null
  and reporter_user_id = auth.uid()
);

create policy "Feedback items updatable by reporter-new or host"
on public.feedback_items
for update
using (
  auth.uid() is not null
  and (
    public.has_feedback_center_triage_access(auth.uid())
    or (reporter_user_id = auth.uid() and status = 'new')
  )
)
with check (
  auth.uid() is not null
  and (
    public.has_feedback_center_triage_access(auth.uid())
    or (reporter_user_id = auth.uid() and status = 'new')
  )
);
