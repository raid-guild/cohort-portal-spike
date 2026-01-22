create table if not exists public.cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'upcoming',
  start_at timestamptz,
  end_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cohort_content (
  cohort_id uuid primary key references public.cohorts (id) on delete cascade,
  schedule jsonb,
  projects jsonb,
  resources jsonb,
  notes jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_cohorts_updated_at on public.cohorts;
create trigger set_cohorts_updated_at
before update on public.cohorts
for each row execute function public.set_updated_at();

drop trigger if exists set_cohort_content_updated_at on public.cohort_content;
create trigger set_cohort_content_updated_at
before update on public.cohort_content
for each row execute function public.set_updated_at();

alter table public.cohorts enable row level security;
alter table public.cohort_content enable row level security;
