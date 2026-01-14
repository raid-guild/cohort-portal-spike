insert into public.profiles (
  user_id,
  handle,
  display_name,
  bio,
  avatar_url,
  wallet_address,
  email,
  links,
  cohorts,
  skills,
  roles,
  location,
  contact
) values
(
  null,
  'dekanbrown',
  'Dekan Brown',
  'Builder at RaidGuild. Shipping cohort infrastructure and onboarding flows.',
  'https://example.com/avatars/dekan.png',
  null,
  'dekan@example.com',
  '[{"label":"Website","url":"https://example.com"},{"label":"Farcaster","url":"https://warpcast.com/dekan"}]'::jsonb,
  '[{"id":"cohort-x","role":"host","year":2026}]'::jsonb,
  '{"Account Manager","Community","Marketing"}',
  '{"Cleric"}',
  'Portland, OR',
  '{"farcaster":"dekan","telegram":"dekanbrown"}'::jsonb
),
(
  null,
  'lanelead',
  'Lane Lead',
  'Leading onboarding lane. Focused on profile signup and roster automation.',
  'https://example.com/avatars/lanelead.png',
  '0x0000000000000000000000000000000000000000',
  null,
  '[{"label":"Onboarding Module","url":"https://example.com/onboarding"}]'::jsonb,
  '[{"id":"cohort-x","role":"lane-lead","year":2026}]'::jsonb,
  '{"Design","UX/User Testing","Project Manager"}',
  '{"Archer"}',
  'Remote',
  '{"telegram":"lanelead"}'::jsonb
),
(
  null,
  'raiderdev',
  'Raider Dev',
  'Full-stack dev building module integrations.',
  'https://example.com/avatars/raiderdev.png',
  null,
  null,
  '[{"label":"GitHub","url":"https://github.com/raiderdev"},{"label":"Projects","url":"https://example.com/projects"}]'::jsonb,
  '[{"id":"cohort-x","role":"builder","year":2026}]'::jsonb,
  '{"Frontend Dev","Backend Dev","DevOps"}',
  '{"Warrior"}',
  'Remote',
  '{"email":"raiderdev@example.com"}'::jsonb
);

insert into public.announcements (
  title,
  body,
  status,
  audience,
  role_targets,
  starts_at,
  ends_at
) values
(
  'Cohort kickoff call',
  'Join the kickoff call this Friday at 10am PT. Bring your module ideas.',
  'published',
  'public',
  null,
  '2026-01-09T18:00:00Z',
  '2026-01-10T18:00:00Z'
),
(
  'Host sync',
  'Hosts: review onboarding progress and role assignments after standup.',
  'published',
  'host',
  null,
  '2026-01-12T19:00:00Z',
  null
),
(
  'Claim your lane',
  'Add your module entry to the registry so it shows up on the portal.',
  'published',
  'authenticated',
  null,
  null,
  null
);
