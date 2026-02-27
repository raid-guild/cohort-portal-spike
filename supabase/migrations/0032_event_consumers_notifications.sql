-- Event consumers + notification digest foundation

create table if not exists public.portal_event_consumptions (
  consumer_id text not null,
  event_id uuid not null references public.portal_events(id) on delete cascade,
  status text not null default 'processed' check (status in ('processed', 'failed')),
  error text null,
  metadata jsonb null,
  processed_at timestamptz not null default now(),
  primary key (consumer_id, event_id)
);

create index if not exists portal_event_consumptions_event_idx
  on public.portal_event_consumptions (event_id);

alter table public.portal_event_consumptions enable row level security;

create table if not exists public.user_notification_preferences (
  user_id uuid primary key,
  email_enabled boolean not null default false,
  cadence text not null default 'daily' check (cadence in ('daily', 'weekly')),
  blog_enabled boolean not null default false,
  forum_enabled boolean not null default false,
  grimoire_enabled boolean not null default false,
  last_digest_sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_user_notification_preferences_updated_at on public.user_notification_preferences;
create trigger set_user_notification_preferences_updated_at
before update on public.user_notification_preferences
for each row execute function public.set_updated_at();

alter table public.user_notification_preferences enable row level security;

-- Preferences are user-owned.
drop policy if exists "Users can read own notification preferences" on public.user_notification_preferences;
create policy "Users can read own notification preferences"
on public.user_notification_preferences
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own notification preferences" on public.user_notification_preferences;
create policy "Users can insert own notification preferences"
on public.user_notification_preferences
for insert
with check (auth.uid() = user_id);

-- Pilot safety default: keep notifications opt-in until rollout completes.
update public.user_notification_preferences
set
  email_enabled = false,
  blog_enabled = false,
  forum_enabled = false,
  grimoire_enabled = false,
  updated_at = now();

drop policy if exists "Users can update own notification preferences" on public.user_notification_preferences;
create policy "Users can update own notification preferences"
on public.user_notification_preferences
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Dedupe queued digest jobs by digest_key.
alter table public.integration_outbox
  add constraint integration_outbox_digest_ready_requires_key
  check (
    event_type <> 'notification.digest.ready'
    or nullif(payload ->> 'digest_key', '') is not null
  );

create unique index if not exists integration_outbox_dedupe_notification_digest_ready_idx
  on public.integration_outbox (event_type, ((payload ->> 'digest_key')))
  where event_type = 'notification.digest.ready';

-- Seed automation badge definition if missing.
insert into public.badge_definitions (id, title, description, sort_order, is_active)
values (
  'grimoire-first-note',
  'First Grimoire Note',
  'Awarded for publishing your first Guild Grimoire note.',
  200,
  true
)
on conflict (id) do nothing;
