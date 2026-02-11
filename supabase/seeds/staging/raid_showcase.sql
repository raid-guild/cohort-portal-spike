-- Staging seed: Raid Showcase fixtures
-- Idempotent: uses fixed UUIDs for showcase_posts.

insert into public.showcase_posts (
  id,
  user_id,
  image_url,
  title,
  impact_statement,
  boost_count
) values
(
  '11111111-1111-1111-1111-111111111111',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'https://picsum.photos/seed/raid-showcase-1/1200/800',
  'Shipped a new module skeleton',
  'Built a working end-to-end slice (UI + API + migrations) and documented a staging test plan.',
  2
),
(
  '22222222-2222-2222-2222-222222222222',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'https://picsum.photos/seed/raid-showcase-2/1200/800',
  'Fixed a tricky auth bug',
  'Unblocked a route by properly validating tokens server-side and improving error messages.',
  1
),
(
  '33333333-3333-3333-3333-333333333333',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'https://picsum.photos/seed/raid-showcase-3/1200/800',
  'Hosted the sprint kickoff',
  'Aligned the cohort on priorities and clarified acceptance criteria for the next modules.',
  0
),
(
  '44444444-4444-4444-4444-444444444444',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'https://picsum.photos/seed/raid-showcase-4/1200/800',
  'Improved lint + CI stability',
  'Reduced flaky checks by tightening TypeScript configs and fixing a few edge-case imports.',
  3
),
(
  '55555555-5555-5555-5555-555555555555',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'https://picsum.photos/seed/raid-showcase-5/1200/800',
  'Published a cohort update',
  'Summarized the week's progress and shared next steps so everyone stays aligned.',
  0
)
on conflict (id) do update set
  user_id = excluded.user_id,
  image_url = excluded.image_url,
  title = excluded.title,
  impact_statement = excluded.impact_statement,
  boost_count = excluded.boost_count;
