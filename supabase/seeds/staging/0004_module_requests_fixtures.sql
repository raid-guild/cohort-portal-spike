-- Staging fixtures: Module Requests
-- Idempotent upserts with deterministic UUIDs.

-- Personas from 0002_people_fixtures.sql
--  - staging-host:         aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
--  - staging-contributor:  bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
--  - staging-admin:        cccccccc-cccc-cccc-cccc-cccccccccccc

-- Requests
insert into public.module_requests (
  id,
  created_by,
  module_id,
  title,
  owner_contact,
  status,
  spec,
  promotion_threshold,
  github_issue_url,
  submitted_to_github_at,
  created_at,
  updated_at,
  deleted_at
) values
(
  '11111111-1111-1111-1111-111111111111',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'skill-swap',
  'Skill Swap',
  'discord:@staging_contributor',
  'open',
  jsonb_build_object(
    'module_id','skill-swap',
    'owner','discord:@staging_contributor',
    'problem','Members want a lightweight way to swap skills.',
    'scope','MVP: offers + requests',
    'ux','List + detail + create form',
    'testing','Manual smoke test'
  ),
  10,
  null,
  null,
  now() - interval '4 days',
  now() - interval '4 days',
  null
),
(
  '22222222-2222-2222-2222-222222222222',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'project-kudos',
  'Project Kudos',
  'discord:@staging_contributor',
  'open',
  jsonb_build_object(
    'module_id','project-kudos',
    'owner','discord:@staging_contributor',
    'problem','Recognize shipped work with quick kudos.',
    'scope','MVP: kudos posts',
    'ux','Cards + reactions later',
    'testing','Manual smoke test'
  ),
  10,
  null,
  null,
  now() - interval '2 days',
  now() - interval '2 days',
  null
),
(
  '33333333-3333-3333-3333-333333333333',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'module-requests',
  'Module Requests',
  'discord:@portal',
  'ready',
  jsonb_build_object(
    'module_id','module-requests',
    'owner','discord:@portal',
    'problem','A front door for module ideas.',
    'scope','MVP: create + vote + promote',
    'ux','New/Trending/Ready',
    'testing','Manual smoke test'
  ),
  3,
  null,
  null,
  now() - interval '1 day',
  now() - interval '1 day',
  null
)
on conflict (id) do update set
  created_by = excluded.created_by,
  module_id = excluded.module_id,
  title = excluded.title,
  owner_contact = excluded.owner_contact,
  status = excluded.status,
  spec = excluded.spec,
  promotion_threshold = excluded.promotion_threshold,
  github_issue_url = excluded.github_issue_url,
  submitted_to_github_at = excluded.submitted_to_github_at,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at;

-- Votes (composite PK)
insert into public.module_request_votes (request_id, user_id, created_at) values
  -- 2 votes on an open request
  ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', now() - interval '2 days'),
  ('22222222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccccc', now() - interval '2 days'),

  -- 3 votes (threshold=3) on a ready request
  ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', now() - interval '1 day'),
  ('33333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', now() - interval '1 day'),
  ('33333333-3333-3333-3333-333333333333', 'cccccccc-cccc-cccc-cccc-cccccccccccc', now() - interval '1 day')
on conflict (request_id, user_id) do nothing;
