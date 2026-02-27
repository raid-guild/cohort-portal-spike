-- Staging seed: Notification Manager fixtures
-- Idempotent deterministic rows for authenticated user and host reviewer.

insert into public.user_notification_preferences (
  user_id,
  email_enabled,
  cadence,
  blog_enabled,
  forum_enabled,
  grimoire_enabled,
  last_digest_sent_at,
  created_at,
  updated_at
) values
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    true,
    'weekly',
    true,
    true,
    false,
    '2026-02-25T00:00:00Z'::timestamptz,
    '2026-02-20T00:00:00Z'::timestamptz,
    '2026-02-26T00:00:00Z'::timestamptz
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    false,
    'daily',
    false,
    false,
    false,
    null,
    '2026-02-20T00:00:00Z'::timestamptz,
    '2026-02-26T12:00:00Z'::timestamptz
  )
on conflict (user_id) do update set
  email_enabled = excluded.email_enabled,
  cadence = excluded.cadence,
  blog_enabled = excluded.blog_enabled,
  forum_enabled = excluded.forum_enabled,
  grimoire_enabled = excluded.grimoire_enabled,
  last_digest_sent_at = excluded.last_digest_sent_at,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;
