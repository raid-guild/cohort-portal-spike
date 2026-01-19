create table if not exists public.cohort_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  intent text not null,
  goals text not null,
  time_commitment text not null,
  work_interest text not null,
  past_work text,
  status text not null default 'submitted',
  signal_check_status text not null default 'pending',
  commitment_path text,
  payment_status text not null default 'unpaid',
  applied_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cohort_applications_user_id_idx
  on public.cohort_applications (user_id);

create index if not exists cohort_applications_status_idx
  on public.cohort_applications (status);

drop trigger if exists set_cohort_applications_updated_at on public.cohort_applications;
create trigger set_cohort_applications_updated_at
before update on public.cohort_applications
for each row execute function public.set_updated_at();

alter table public.cohort_applications enable row level security;

create policy "Applicants can insert their application"
on public.cohort_applications
for insert
with check (auth.uid() = user_id);

create policy "Applicants can view their application"
on public.cohort_applications
for select
using (auth.uid() = user_id);
