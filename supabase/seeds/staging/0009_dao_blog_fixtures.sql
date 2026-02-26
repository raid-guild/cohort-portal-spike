-- Staging seed: DAO Blog fixtures
-- Idempotent deterministic data for anonymous reader, dao-member author, and host reviewer.

insert into public.user_roles (user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'host')
on conflict (user_id, role) do nothing;

insert into public.entitlements (user_id, entitlement, status) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'dao-member', 'active')
on conflict (user_id, entitlement) do update set
  status = excluded.status,
  expires_at = null,
  updated_at = now();

insert into public.dao_blog_posts (
  id,
  title,
  slug,
  summary,
  header_image_url,
  body_md,
  status,
  published_at,
  author_user_id,
  review_submitted_at,
  reviewed_at,
  reviewed_by,
  review_notes,
  created_at,
  updated_at,
  deleted_at
) values
  (
    'a1000000-0000-0000-0000-000000000001',
    'Cohort Portal Milestone Update',
    'cohort-portal-milestone-update',
    'A public progress report on cohort portal module delivery and launch readiness.',
    'https://images.unsplash.com/photo-1552664730-d307ca884978',
    '## Milestone update\n\nWe shipped the first set of portal module scaffolds and host workflows.\n\n- Registry updates landed\n- Staging fixtures are in place\n- Next focus: polish and QA',
    'published',
    now() - interval '2 days',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    now() - interval '3 days',
    now() - interval '2 days',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    null,
    now() - interval '5 days',
    now() - interval '2 days',
    null
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'What We Learned From Module-Spec Automation',
    'what-we-learned-from-module-spec-automation',
    'Lessons from generating implementation scaffolds directly from module-spec issues.',
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085',
    '## Draft notes\n\nStill refining these lessons before submission.',
    'draft',
    null,
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    null,
    null,
    null,
    null,
    now() - interval '1 day',
    now() - interval '1 day',
    null
  ),
  (
    'a1000000-0000-0000-0000-000000000003',
    'Q2 Sponsor Outreach Narrative',
    'q2-sponsor-outreach-narrative',
    'Draft narrative prepared for host review before publishing externally.',
    'https://images.unsplash.com/photo-1517048676732-d65bc937f952',
    '## In review\n\nThis draft is awaiting host approval.',
    'in_review',
    null,
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    now() - interval '4 hours',
    null,
    null,
    null,
    now() - interval '12 hours',
    now() - interval '4 hours',
    null
  )
on conflict (id) do update set
  title = excluded.title,
  slug = excluded.slug,
  summary = excluded.summary,
  header_image_url = excluded.header_image_url,
  body_md = excluded.body_md,
  status = excluded.status,
  published_at = excluded.published_at,
  author_user_id = excluded.author_user_id,
  review_submitted_at = excluded.review_submitted_at,
  reviewed_at = excluded.reviewed_at,
  reviewed_by = excluded.reviewed_by,
  review_notes = excluded.review_notes,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at;
