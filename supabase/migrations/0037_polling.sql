create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_by uuid not null references auth.users(id) on delete cascade,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  status text not null default 'open' check (status in ('draft', 'open', 'closed')),
  allow_vote_change boolean not null default false,
  results_visibility text not null default 'live' check (results_visibility in ('live', 'after_close')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint polls_window_valid check (closes_at > opens_at)
);

create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  label text not null,
  subject_user_id uuid references auth.users(id) on delete set null,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint poll_options_label_not_blank check (length(trim(label)) > 0),
  unique (poll_id, id)
);

create table if not exists public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null,
  voter_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (poll_id, voter_user_id),
  constraint poll_votes_poll_option_fk
    foreign key (poll_id, option_id)
    references public.poll_options (poll_id, id)
    on delete cascade
);

create table if not exists public.poll_eligibility_rules (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  action text not null check (action in ('create', 'vote', 'view_results')),
  rule_type text not null check (rule_type in ('authenticated', 'role', 'entitlement')),
  rule_value text,
  created_at timestamptz not null default now(),
  constraint poll_eligibility_rule_value_required check (
    (rule_type = 'authenticated' and rule_value is null)
    or (rule_type in ('role', 'entitlement') and rule_value is not null and length(trim(rule_value)) > 0)
  )
);

create index if not exists polls_status_window_idx
  on public.polls (status, opens_at, closes_at);

create index if not exists poll_options_poll_sort_idx
  on public.poll_options (poll_id, sort_order);

create index if not exists poll_votes_poll_option_idx
  on public.poll_votes (poll_id, option_id);

create index if not exists poll_votes_voter_user_idx
  on public.poll_votes (voter_user_id, poll_id);

create index if not exists poll_eligibility_rules_poll_action_idx
  on public.poll_eligibility_rules (poll_id, action);

create index if not exists poll_eligibility_rules_poll_rule_type_idx
  on public.poll_eligibility_rules (poll_id, rule_type);

drop trigger if exists set_polls_updated_at on public.polls;
create trigger set_polls_updated_at
before update on public.polls
for each row execute function public.set_updated_at();

drop trigger if exists set_poll_votes_updated_at on public.poll_votes;
create trigger set_poll_votes_updated_at
before update on public.poll_votes
for each row execute function public.set_updated_at();

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
alter table public.poll_eligibility_rules enable row level security;

drop policy if exists polls_service_role_only on public.polls;
create policy polls_service_role_only
  on public.polls
  for all
  to public
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists poll_options_service_role_only on public.poll_options;
create policy poll_options_service_role_only
  on public.poll_options
  for all
  to public
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists poll_votes_service_role_only on public.poll_votes;
create policy poll_votes_service_role_only
  on public.poll_votes
  for all
  to public
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists poll_eligibility_rules_service_role_only on public.poll_eligibility_rules;
create policy poll_eligibility_rules_service_role_only
  on public.poll_eligibility_rules
  for all
  to public
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
