-- Staging seed: bounty board fixtures
-- Idempotent: deterministic UUIDs + upserts.
-- Safe for staging only.

-- Test personas (not necessarily real auth users; there are no FKs to auth.users)
-- host/admin-ish
-- contributor-ish

-- Deterministic UUIDs (generated once):
-- bounties:
--   11111111-1111-1111-1111-111111111111 (OPEN)
--   22222222-2222-2222-2222-222222222222 (CLAIMED)
-- claims:
--   33333333-3333-3333-3333-333333333333
-- comments:
--   44444444-4444-4444-4444-444444444444
--   55555555-5555-5555-5555-555555555555

-- Users (fake but stable)
--   aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa (host)
--   bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb (contributor)

insert into public.bounties (
  id,
  title,
  description,
  status,
  github_url,
  reward_type,
  reward_amount,
  reward_token,
  badge_id,
  created_by,
  due_at,
  tags
) values
(
  '11111111-1111-1111-1111-111111111111',
  'Staging: Add module card polish',
  'Fixture bounty for staging smoke tests. Should remain OPEN.',
  'open',
  'https://github.com/raid-guild/cohort-portal-spike/issues/8',
  'none',
  null,
  null,
  null,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  now() + interval '7 days',
  array['staging','fixture','ui']
),
(
  '22222222-2222-2222-2222-222222222222',
  'Staging: Implement bounty lifecycle',
  'Fixture bounty for staging smoke tests. Should have an active CLAIM.',
  'claimed',
  'https://github.com/raid-guild/cohort-portal-spike/pull/9',
  'none',
  null,
  null,
  null,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  now() + interval '3 days',
  array['staging','fixture','bounty-board']
)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  status = excluded.status,
  github_url = excluded.github_url,
  reward_type = excluded.reward_type,
  reward_amount = excluded.reward_amount,
  reward_token = excluded.reward_token,
  badge_id = excluded.badge_id,
  created_by = excluded.created_by,
  due_at = excluded.due_at,
  tags = excluded.tags;

insert into public.bounty_claims (
  id,
  bounty_id,
  user_id,
  status,
  submitted_at,
  resolved_at
) values (
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'claimed',
  null,
  null
)
on conflict (id) do update set
  bounty_id = excluded.bounty_id,
  user_id = excluded.user_id,
  status = excluded.status,
  submitted_at = excluded.submitted_at,
  resolved_at = excluded.resolved_at;

insert into public.bounty_comments (
  id,
  bounty_id,
  user_id,
  body
) values
(
  '44444444-4444-4444-4444-444444444444',
  '11111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Seed comment: This is a staging fixture comment on the OPEN bounty.'
),
(
  '55555555-5555-5555-5555-555555555555',
  '22222222-2222-2222-2222-222222222222',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'Seed comment: I plan to claim this and submit work soon.'
)
on conflict (id) do update set
  bounty_id = excluded.bounty_id,
  user_id = excluded.user_id,
  body = excluded.body;
