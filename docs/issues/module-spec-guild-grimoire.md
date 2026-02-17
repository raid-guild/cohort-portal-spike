# module-spec: Guild Grimoire

## Module ID
`guild-grimoire`

## Owner / contact
`@dekanbro` (update if different)

## Problem / user value
Guild members need a minimal, mobile-first way to quickly post short updates from the field. Guild Grimoire provides a simple capture flow for text, image, or audio notes so members can share lightweight updates and browse a shared stream.

Primary users:
- Any signed-in user posting quick updates
- Community members browsing shared notes in People Tools

## Scope (what's in / out)
In scope:
- Create a note with one content mode only:
  - text note (max 256 chars), or
  - image note (1 image), or
  - audio note (1 audio clip)
- No mixed attachments (no image+audio combo on one note)
- Global tag list with user-created tags
- Assign tags to notes
- Shared feed with filters (tags, content type, visibility, mine/all)
- No edit after post
- Soft delete only (owner can soft-delete own notes)
- Mobile-first minimal UI with three primary actions: Audio, Image, Note

Out of scope (future):
- Editing published notes
- Reactions/comments
- AI transcription/summarization
- Moderation workflows beyond owner delete + existing admin DB access
- Offline sync

## UX / surfaces
Surfaces:
- `people-tools` (primary): shared feed and quick composer

Experience:
- Mobile-first, minimal composer UI with 3 clear action buttons:
  - `Note`
  - `Image`
  - `Audio`
- Default visibility for new note: `shared` (public/shared default)
- Feed defaults to showing shared/public notes; include toggle/filter for `mine`
- Filter controls:
  - tag
  - content type (`text|image|audio`)
  - visibility (`shared|cohort|public` based on viewer access)
  - mine/all

Key states:
- Empty feed state
- Empty personal state
- Upload/recording in progress
- Post success/error toast
- Soft-deleted notes hidden from normal feed queries

## Storage preference
`new tables + migrations`

## Data model (fields)
Proposed tables:

1) `public.guild_grimoire_notes`
- `id uuid pk default gen_random_uuid()`
- `user_id uuid not null` (owner)
- `content_type text not null` check in (`text`, `image`, `audio`)
- `text_content text null` check `char_length(text_content) <= 256`
- `image_url text null`
- `audio_url text null`
- `audio_duration_sec int null`
- `visibility text not null default 'shared'` check in (`private`, `shared`, `cohort`, `public`)
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `deleted_at timestamptz null`

Constraints:
- Exactly one mode per note:
  - if `content_type='text'`: `text_content` required, `image_url`/`audio_url` null
  - if `content_type='image'`: `image_url` required, text/audio null
  - if `content_type='audio'`: `audio_url` required, text/image null

2) `public.guild_grimoire_tags`
- `id uuid pk default gen_random_uuid()`
- `slug text unique not null`
- `label text unique not null`
- `created_by uuid not null`
- `created_at timestamptz not null default now()`
- `is_active boolean not null default true`

3) `public.guild_grimoire_note_tags`
- `note_id uuid not null references public.guild_grimoire_notes(id)`
- `tag_id uuid not null references public.guild_grimoire_tags(id)`
- PK (`note_id`, `tag_id`)

Recommended limits (reasonable defaults):
- Image: max 5 MB; `image/jpeg`, `image/png`, `image/webp`
- Audio: max 60 seconds, max 3 MB; `audio/webm`, `audio/mp4`, `audio/m4a`

Storage:
- Supabase public storage bucket for module media (e.g. `guild-grimoire-media`)
- Store only URLs + metadata in tables

## API requirements
Module endpoints (portal-owned):

- `GET /api/modules/guild-grimoire/feed`
  - Query: `tag`, `contentType`, `visibility`, `mine`, `cursor`, `limit`
  - Returns shared feed rows (plus owner rows when `mine=true`)

- `POST /api/modules/guild-grimoire/notes`
  - Auth required
  - Creates one note (text OR image OR audio)
  - Enforces no-edit model and validation

- `DELETE /api/modules/guild-grimoire/notes/[id]`
  - Auth required
  - Owner-only soft delete (`deleted_at=now()`)

- `GET /api/modules/guild-grimoire/tags`
  - Returns active global tags

- `POST /api/modules/guild-grimoire/tags`
  - Auth required
  - Allows any signed-in user to create tag (dedupe by slug/label)

- `GET /api/modules/guild-grimoire/summary`
  - For module card summary (e.g. user note count + latest shared note)

Auth & authorization:
- All write endpoints require signed-in user
- RLS enforces ownership on delete and private visibility reads
- Module available to all signed-in users; no entitlement gate for v1

## Portal RPC (optional)
Not required for v1.

## Allowed iframe origins (optional)
N/A for v1 (portal-owned module route)

## Acceptance criteria
- [ ] Module is registered in `modules/registry.json`
- [ ] Module appears in `people-tools`
- [ ] Mobile-first composer renders with 3 actions: Note, Image, Audio
- [ ] User can post one note in exactly one mode (text/image/audio)
- [ ] Text notes enforce 256-character max
- [ ] Image/audio notes enforce file size/type limits
- [ ] Any signed-in user can create new global tags
- [ ] Feed filtering works for tag/content type/visibility/mine-all
- [ ] No edit action exists after post
- [ ] Owner can soft-delete own notes
- [ ] Shared feed excludes soft-deleted rows
- [ ] Summary endpoint renders on module card
- [ ] Lint passes

## Testing / seed data (required for DB-backed features)
- [ ] Seed plan: add deterministic users, tags, and sample notes covering all 3 content types
- [ ] Staging seed added (idempotent; safe to run repeatedly)
  - Location: `supabase/seeds/staging/`
  - Uses deterministic IDs and/or upserts
- [ ] Personas covered: signed-in user, host/admin spot-check
- [ ] Smoke tests defined:
  - API checks:
    - create text note succeeds
    - create image/audio note rejects invalid size/type
    - owner soft-delete succeeds; non-owner soft-delete blocked
    - feed filters return expected rows
  - Optional Playwright mobile flow:
    - create note from mobile viewport
    - record/upload media and post
    - filter shared feed

## Automation consent
- [x] OK to auto-generate a PR for this spec
