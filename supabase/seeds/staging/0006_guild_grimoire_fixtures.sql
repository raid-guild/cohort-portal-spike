-- Staging seed: Guild Grimoire fixtures
-- Idempotent: deterministic UUIDs + upserts.

-- Tags
insert into public.guild_grimoire_tags (id, slug, label, created_by, created_at, is_active)
values
  ('11111111-1111-1111-1111-111111111111', 'field-update', 'Field update', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', now(), true),
  ('22222222-2222-2222-2222-222222222222', 'ship-log', 'Ship log', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', now(), true),
  ('33333333-3333-3333-3333-333333333333', 'audio', 'Audio', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', now(), true)
on conflict (id) do update set
  slug = excluded.slug,
  label = excluded.label,
  is_active = excluded.is_active;

-- Notes
insert into public.guild_grimoire_notes (
  id,
  user_id,
  content_type,
  text_content,
  image_url,
  audio_url,
  audio_duration_sec,
  visibility,
  created_at,
  updated_at,
  deleted_at
)
values
  (
    'aaaaaaaa-1111-1111-1111-111111111111',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'text',
    'Staging text note: quick update from the field.',
    null,
    null,
    null,
    'shared',
    now() - interval '2 days',
    now() - interval '2 days',
    null
  ),
  (
    'bbbbbbbb-2222-2222-2222-222222222222',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'image',
    null,
    'https://images.unsplash.com/photo-1520975916090-3105956dac38?auto=format&fit=crop&w=1200&q=60',
    null,
    null,
    'shared',
    now() - interval '1 day',
    now() - interval '1 day',
    null
  ),
  (
    'cccccccc-3333-3333-3333-333333333333',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'audio',
    null,
    null,
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/8/8f/Test_ogg_mp3_48kbps.ogg/Test_ogg_mp3_48kbps.ogg.mp3',
    12,
    'shared',
    now() - interval '12 hours',
    now() - interval '12 hours',
    null
  )
on conflict (id) do update set
  text_content = excluded.text_content,
  image_url = excluded.image_url,
  audio_url = excluded.audio_url,
  audio_duration_sec = excluded.audio_duration_sec,
  visibility = excluded.visibility,
  deleted_at = excluded.deleted_at;

-- Note <-> tag links
insert into public.guild_grimoire_note_tags (note_id, tag_id)
values
  ('aaaaaaaa-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),
  ('bbbbbbbb-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222'),
  ('cccccccc-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333')
on conflict do nothing;
