-- Staging seed: Member Forum fixtures
-- Idempotent: deterministic IDs + upserts.

-- Additional auth users for entitlement personas.
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
(
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'staging-no-entitlement@example.com',
  crypt('staging-no-entitlement', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
),
(
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'staging-dao-member@example.com',
  crypt('staging-dao-member', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
),
(
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'staging-cohort-access@example.com',
  crypt('staging-cohort-access', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
)
on conflict (id) do update set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = excluded.updated_at;

insert into public.profiles (
  user_id,
  handle,
  display_name,
  email
) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'staging-no-entitlement', 'Staging No Entitlement', 'staging-no-entitlement@example.com'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'staging-dao-member', 'Staging DAO Member', 'staging-dao-member@example.com'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'staging-cohort-access', 'Staging Cohort Access', 'staging-cohort-access@example.com')
on conflict (handle) do update set
  user_id = excluded.user_id,
  display_name = excluded.display_name,
  email = excluded.email;

-- Persona access bindings.
insert into public.user_roles (user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'host'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'admin')
on conflict (user_id, role) do nothing;

insert into public.entitlements (user_id, entitlement, status) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'dao-member', 'active'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'cohort-access', 'active')
on conflict (user_id, entitlement) do update set
  status = excluded.status,
  updated_at = now();

-- Deterministic spaces for visibility tiers.
insert into public.forum_spaces (
  id,
  slug,
  name,
  description,
  read_level,
  write_level,
  cohort_id,
  created_by,
  created_at,
  updated_at
) values
  (
    '11111111-aaaa-aaaa-aaaa-111111111111',
    'public-square',
    'Public Square',
    'Publicly readable forum space.',
    'public',
    'member',
    null,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    now(),
    now()
  ),
  (
    '22222222-bbbb-bbbb-bbbb-222222222222',
    'members-council',
    'Members Council',
    'DAO member space for async coordination.',
    'member',
    'member',
    null,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    now(),
    now()
  ),
  (
    '33333333-cccc-cccc-cccc-333333333333',
    'cohort-lounge',
    'Cohort Lounge',
    'Paid cohort participant discussion space.',
    'cohort',
    'cohort',
    null,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    now(),
    now()
  )
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  description = excluded.description,
  read_level = excluded.read_level,
  write_level = excluded.write_level,
  cohort_id = excluded.cohort_id,
  updated_at = now();

insert into public.forum_posts (
  id,
  space_id,
  author_id,
  title,
  body_md,
  is_locked,
  is_deleted,
  created_at,
  updated_at
) values
  (
    '44444444-dddd-dddd-dddd-444444444444',
    '11111111-aaaa-aaaa-aaaa-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Welcome to the Public Square',
    'This is visible to anonymous visitors.',
    false,
    false,
    now() - interval '3 days',
    now() - interval '3 days'
  ),
  (
    '55555555-eeee-eeee-eeee-555555555555',
    '22222222-bbbb-bbbb-bbbb-222222222222',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'DAO Member Thread',
    'Members can post and comment here.',
    false,
    false,
    now() - interval '2 days',
    now() - interval '2 days'
  ),
  (
    '66666666-ffff-ffff-ffff-666666666666',
    '33333333-cccc-cccc-cccc-333333333333',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'Cohort-only check-in',
    'Cohort access users can write in this space.',
    true,
    false,
    now() - interval '1 day',
    now() - interval '1 day'
  )
on conflict (id) do update set
  title = excluded.title,
  body_md = excluded.body_md,
  is_locked = excluded.is_locked,
  is_deleted = excluded.is_deleted,
  updated_at = excluded.updated_at;

insert into public.forum_comments (
  id,
  post_id,
  author_id,
  parent_comment_id,
  body_md,
  is_deleted,
  created_at,
  updated_at
) values
  (
    '77777777-aaaa-aaaa-aaaa-777777777777',
    '44444444-dddd-dddd-dddd-444444444444',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    null,
    'Hosts can seed starter context.',
    false,
    now() - interval '2 days',
    now() - interval '2 days'
  ),
  (
    '88888888-bbbb-bbbb-bbbb-888888888888',
    '55555555-eeee-eeee-eeee-555555555555',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    null,
    'DAO members can discuss here.',
    false,
    now() - interval '36 hours',
    now() - interval '36 hours'
  )
on conflict (id) do update set
  body_md = excluded.body_md,
  is_deleted = excluded.is_deleted,
  updated_at = excluded.updated_at;
