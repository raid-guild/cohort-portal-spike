-- Staging seed: Cohort calendar fixtures
-- Idempotent calendar events and sample RSVPs.

insert into public.user_roles (user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'host')
on conflict (user_id, role) do nothing;

insert into public.entitlements (user_id, entitlement, status, metadata, expires_at)
values
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'dao-member',
    'active',
    '{"source":"staging-fixture"}'::jsonb,
    now() + interval '365 days'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'cohort-access',
    'active',
    '{"source":"staging-fixture"}'::jsonb,
    now() + interval '365 days'
  )
on conflict (user_id, entitlement) do update set
  status = excluded.status,
  metadata = excluded.metadata,
  expires_at = excluded.expires_at,
  updated_at = now();

insert into public.calendar_events (
  id,
  title,
  description,
  event_type,
  start_time,
  end_time,
  meeting_url,
  created_by,
  visibility,
  status,
  created_at,
  updated_at
) values
  (
    '97000000-0000-0000-0000-000000000001',
    'Intro to OpenClaw',
    'Community member presentation or demo',
    'brown_bag',
    now() + interval '2 days',
    now() + interval '2 days 20 minutes',
    'https://discord.gg/raidguild',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'members',
    'scheduled',
    now(),
    now()
  ),
  (
    '97000000-0000-0000-0000-000000000002',
    'Agent Automation',
    'Official cohort session',
    'cohort_session',
    now() + interval '4 days',
    now() + interval '4 days 90 minutes',
    'https://zoom.us/j/raidguild-cohort',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'cohort',
    'scheduled',
    now(),
    now()
  ),
  (
    '97000000-0000-0000-0000-000000000003',
    'Weekly Guild Sync',
    'Open community sync for announcements and discussion',
    'community_call',
    now() + interval '6 days',
    now() + interval '6 days 60 minutes',
    'https://meet.google.com/raid-guild-sync',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'public',
    'scheduled',
    now(),
    now()
  )
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  event_type = excluded.event_type,
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  meeting_url = excluded.meeting_url,
  created_by = excluded.created_by,
  visibility = excluded.visibility,
  status = excluded.status,
  updated_at = now();

insert into public.calendar_event_attendees (event_id, user_id, status, created_at, updated_at)
values
  (
    '97000000-0000-0000-0000-000000000001',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'attending',
    now(),
    now()
  ),
  (
    '97000000-0000-0000-0000-000000000002',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'pending',
    now(),
    now()
  )
on conflict (event_id, user_id) do update set
  status = excluded.status,
  updated_at = now();
