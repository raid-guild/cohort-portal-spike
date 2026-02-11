-- Staging seed: Arcane Exchange fixtures
-- Idempotent: upsert by deterministic IDs.

insert into public.looking_for_listings (
  id,
  type,
  title,
  description,
  category,
  tags,
  status,
  created_by,
  contact_method,
  external_contact,
  created_at,
  updated_at,
  fulfilled_at
) values
(
  '11111111-1111-1111-1111-111111111111',
  'looking_for',
  'Need a designer for landing page polish',
  'Looking for quick UI/UX help to tighten up a cohort project landing page.',
  'design',
  array['ui','ux','landing-page'],
  'open',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'dm',
  null,
  now() - interval '7 days',
  now() - interval '1 days',
  null
),
(
  '22222222-2222-2222-2222-222222222222',
  'offering',
  'Offering: TypeScript + Next.js pairing hour',
  'Happy to pair on debugging, API routes, or Supabase integration.',
  'dev',
  array['typescript','nextjs','supabase'],
  'open',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'profile',
  null,
  now() - interval '10 days',
  now() - interval '2 days',
  null
),
(
  '33333333-3333-3333-3333-333333333333',
  'looking_for',
  'Looking for governance template suggestions',
  'Any good lightweight templates for DAO governance docs?',
  'governance',
  array['docs','templates'],
  'fulfilled',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'external',
  'staging-admin@example.com',
  now() - interval '20 days',
  now() - interval '5 days',
  now() - interval '5 days'
)
on conflict (id) do update set
  type = excluded.type,
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  tags = excluded.tags,
  status = excluded.status,
  created_by = excluded.created_by,
  contact_method = excluded.contact_method,
  external_contact = excluded.external_contact,
  updated_at = excluded.updated_at,
  fulfilled_at = excluded.fulfilled_at;
