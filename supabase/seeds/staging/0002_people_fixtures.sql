-- Staging seed: People Directory fixtures
-- Idempotent: upsert by handle (primary key).

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
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'staging-host',
  'Staging Host',
  'Fixture profile for staging previews (host persona).',
  null,
  null,
  'staging-host@example.com',
  '{"website":"https://raidguild.org"}'::jsonb,
  '[{"name":"Spring 2026","role":"host"}]'::jsonb,
  array['Product','Ops'],
  array['host'],
  'Remote',
  '{"discord":"staging-host"}'::jsonb
),
(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'staging-contributor',
  'Staging Contributor',
  'Fixture profile for staging previews (contributor persona).',
  null,
  null,
  'staging-contributor@example.com',
  '{"github":"https://github.com/raid-guild"}'::jsonb,
  '[{"name":"Spring 2026","role":"contributor"}]'::jsonb,
  array['TypeScript','React'],
  array['contributor'],
  'Remote',
  '{"telegram":"@staging_contributor"}'::jsonb
),
(
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'staging-admin',
  'Staging Admin',
  'Fixture profile for staging previews (admin persona).',
  null,
  null,
  'staging-admin@example.com',
  '{"x":"https://x.com/raidguild"}'::jsonb,
  '[{"name":"Spring 2026","role":"admin"}]'::jsonb,
  array['Security','Governance'],
  array['admin'],
  'Remote',
  '{"email":"staging-admin@example.com"}'::jsonb
)
on conflict (handle) do update set
  user_id = excluded.user_id,
  display_name = excluded.display_name,
  bio = excluded.bio,
  avatar_url = excluded.avatar_url,
  wallet_address = excluded.wallet_address,
  email = excluded.email,
  links = excluded.links,
  cohorts = excluded.cohorts,
  skills = excluded.skills,
  roles = excluded.roles,
  location = excluded.location,
  contact = excluded.contact;
