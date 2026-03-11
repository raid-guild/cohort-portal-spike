create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_type text not null check (event_type in ('brown_bag', 'cohort_session', 'community_call')),
  start_time timestamptz not null,
  end_time timestamptz not null,
  meeting_url text,
  created_by uuid not null references auth.users(id) on delete cascade,
  visibility text not null default 'public' check (visibility in ('public', 'members', 'cohort')),
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_events_window_valid check (end_time > start_time)
);

create table if not exists public.calendar_event_attendees (
  event_id uuid not null references public.calendar_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('attending', 'declined', 'pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists calendar_events_window_idx
  on public.calendar_events (start_time, end_time);

create index if not exists calendar_events_status_visibility_idx
  on public.calendar_events (status, visibility, start_time);

create index if not exists calendar_event_attendees_user_idx
  on public.calendar_event_attendees (user_id, event_id);

drop trigger if exists set_calendar_events_updated_at on public.calendar_events;
create trigger set_calendar_events_updated_at
before update on public.calendar_events
for each row execute function public.set_updated_at();

drop trigger if exists set_calendar_event_attendees_updated_at on public.calendar_event_attendees;
create trigger set_calendar_event_attendees_updated_at
before update on public.calendar_event_attendees
for each row execute function public.set_updated_at();

alter table public.calendar_events enable row level security;
alter table public.calendar_event_attendees enable row level security;

drop policy if exists calendar_events_service_role_only on public.calendar_events;
create policy calendar_events_service_role_only
  on public.calendar_events
  for all
  to public
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists calendar_event_attendees_service_role_only on public.calendar_event_attendees;
create policy calendar_event_attendees_service_role_only
  on public.calendar_event_attendees
  for all
  to public
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
