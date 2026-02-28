-- Staging seed: Polling fixtures
-- Idempotent deterministic polls with eligibility and vote examples.

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
  )
on conflict (user_id, entitlement) do update set
  status = excluded.status,
  metadata = excluded.metadata,
  expires_at = excluded.expires_at,
  updated_at = now();

insert into public.polls (
  id,
  title,
  description,
  created_by,
  opens_at,
  closes_at,
  status,
  allow_vote_change,
  results_visibility,
  created_at,
  updated_at
) values
  (
    '84000000-0000-0000-0000-000000000001',
    'Raider of the Month - Staging',
    'Fixture poll restricted to dao-member voters with live results.',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    now() - interval '2 days',
    now() + interval '2 days',
    'open',
    true,
    'live',
    now() - interval '2 days',
    now() - interval '2 days'
  ),
  (
    '84000000-0000-0000-0000-000000000002',
    'Cohort Preference Snapshot - Closed',
    'Fixture closed poll with after-close results visibility.',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    now() - interval '10 days',
    now() - interval '5 days',
    'closed',
    false,
    'after_close',
    now() - interval '10 days',
    now() - interval '5 days'
  )
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  created_by = excluded.created_by,
  opens_at = excluded.opens_at,
  closes_at = excluded.closes_at,
  status = excluded.status,
  allow_vote_change = excluded.allow_vote_change,
  results_visibility = excluded.results_visibility,
  updated_at = now();

insert into public.poll_options (
  id,
  poll_id,
  label,
  subject_user_id,
  sort_order,
  metadata,
  created_at
) values
  (
    '84000000-0000-0000-0000-000000000101',
    '84000000-0000-0000-0000-000000000001',
    'Nominee Alpha',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    0,
    '{}'::jsonb,
    now() - interval '2 days'
  ),
  (
    '84000000-0000-0000-0000-000000000102',
    '84000000-0000-0000-0000-000000000001',
    'Nominee Beta',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    1,
    '{}'::jsonb,
    now() - interval '2 days'
  ),
  (
    '84000000-0000-0000-0000-000000000201',
    '84000000-0000-0000-0000-000000000002',
    'Async standup preference',
    null,
    0,
    '{}'::jsonb,
    now() - interval '10 days'
  ),
  (
    '84000000-0000-0000-0000-000000000202',
    '84000000-0000-0000-0000-000000000002',
    'Live sync preference',
    null,
    1,
    '{}'::jsonb,
    now() - interval '10 days'
  )
on conflict (id) do update set
  poll_id = excluded.poll_id,
  label = excluded.label,
  subject_user_id = excluded.subject_user_id,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata;

insert into public.poll_eligibility_rules (
  id,
  poll_id,
  action,
  rule_type,
  rule_value,
  created_at
) values
  (
    '84000000-0000-0000-0000-000000000301',
    '84000000-0000-0000-0000-000000000001',
    'create',
    'authenticated',
    null,
    now() - interval '2 days'
  ),
  (
    '84000000-0000-0000-0000-000000000302',
    '84000000-0000-0000-0000-000000000001',
    'vote',
    'entitlement',
    'dao-member',
    now() - interval '2 days'
  ),
  (
    '84000000-0000-0000-0000-000000000303',
    '84000000-0000-0000-0000-000000000001',
    'view_results',
    'authenticated',
    null,
    now() - interval '2 days'
  ),
  (
    '84000000-0000-0000-0000-000000000304',
    '84000000-0000-0000-0000-000000000002',
    'create',
    'authenticated',
    null,
    now() - interval '10 days'
  ),
  (
    '84000000-0000-0000-0000-000000000305',
    '84000000-0000-0000-0000-000000000002',
    'vote',
    'authenticated',
    null,
    now() - interval '10 days'
  ),
  (
    '84000000-0000-0000-0000-000000000306',
    '84000000-0000-0000-0000-000000000002',
    'view_results',
    'authenticated',
    null,
    now() - interval '10 days'
  )
on conflict (id) do update set
  poll_id = excluded.poll_id,
  action = excluded.action,
  rule_type = excluded.rule_type,
  rule_value = excluded.rule_value;

insert into public.poll_votes (
  id,
  poll_id,
  option_id,
  voter_user_id,
  created_at,
  updated_at
) values
  (
    '84000000-0000-0000-0000-000000000401',
    '84000000-0000-0000-0000-000000000001',
    '84000000-0000-0000-0000-000000000101',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    now() - interval '1 day',
    now() - interval '1 day'
  ),
  (
    '84000000-0000-0000-0000-000000000402',
    '84000000-0000-0000-0000-000000000002',
    '84000000-0000-0000-0000-000000000201',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    now() - interval '9 days',
    now() - interval '9 days'
  )
on conflict (id) do update set
  poll_id = excluded.poll_id,
  option_id = excluded.option_id,
  voter_user_id = excluded.voter_user_id,
  updated_at = excluded.updated_at;
