# module-spec: Member Forum

## Module ID
`member-forum`

## Owner / contact
`@dekanbro` (update if different)

## Problem / user value
RaidGuild needs a lightweight, async discussion module for ongoing coordination that feels familiar (Reddit-like spaces, posts, comments) while respecting community access boundaries.

Primary users:
- Public visitors browsing public spaces
- DAO members posting in member spaces
- Cohort participants posting in cohort spaces
- Hosts moderating when needed

Core value:
- Centralize discussions inside the portal
- Keep access enforcement in Supabase/Postgres (RLS), not only UI
- Start small (spaces + posts + comments) with room to expand later

## Scope (what's in / out)
In scope:
- Space-based forum model (like lightweight subreddits)
- Tiered access at space level:
  - read: `public | member | cohort`
  - write: `member | cohort` (no public writes)
- Posts with markdown body
- Threaded comments (via `parent_comment_id`)
- Soft-delete support for posts/comments
- Basic lock flag on posts (`is_locked`)
- Module summary endpoint for module card
- Host moderation v1: lock/unlock and soft-delete via API

Out of scope (future):
- Voting/karma ranking
- Rich media uploads/embeds
- Advanced moderation queue and reports
- Full-text search UX
- Realtime subscriptions/notifications

## UX / surfaces
Surfaces:
- `people-tools` (primary shared discovery surface)
- Optional later: `member-tools` summary variant for member-focused view

Module route and views:
- `/modules/member-forum` (feed + space list)
- `/modules/member-forum/s/[spaceSlug]` (space feed)
- `/modules/member-forum/p/[postId]` (post + comments)
- `/modules/member-forum/new?space=<slug>` (create post)

Key UI states:
- Public visitor sees only public spaces/posts
- Signed-in user sees additional spaces based on entitlements
- Composer hidden/disabled when user lacks write permission
- Locked post disallows new comments
- Deleted rows hidden from standard feed

## Storage preference
`new tables + migrations`

## Data model (fields)
Proposed tables:

1) `public.forum_spaces`
- `id uuid pk default gen_random_uuid()`
- `slug text unique not null`
- `name text not null`
- `description text null`
- `read_level text not null` check in (`public`, `member`, `cohort`)
- `write_level text not null` check in (`member`, `cohort`)
- `cohort_id uuid null references public.cohorts(id) on delete set null`
- `created_by uuid null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

2) `public.forum_posts`
- `id uuid pk default gen_random_uuid()`
- `space_id uuid not null references public.forum_spaces(id) on delete cascade`
- `author_id uuid not null`
- `title text not null`
- `body_md text not null`
- `is_locked boolean not null default false`
- `is_deleted boolean not null default false`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

3) `public.forum_comments`
- `id uuid pk default gen_random_uuid()`
- `post_id uuid not null references public.forum_posts(id) on delete cascade`
- `author_id uuid not null`
- `parent_comment_id uuid null references public.forum_comments(id) on delete cascade`
- `body_md text not null`
- `is_deleted boolean not null default false`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Access mapping to existing repo patterns:
- `member` access maps to active `dao-member` entitlement
- `cohort` access maps to active `cohort-access` entitlement
- Host role (`public.user_roles`) can be granted moderation permissions

RLS policy intent:
- Read checks by space `read_level`
- Write checks by space `write_level`
- No public writes
- Host moderation bypass limited to moderation actions

## API requirements
Module endpoints (portal-owned):

- `GET /api/modules/member-forum/spaces`
  - Returns visible spaces for current viewer (including anonymous public visibility)

- `GET /api/modules/member-forum/posts`
  - Query: `space`, `cursor`, `limit`, `sort`
  - Returns visible posts only (`is_deleted=false`)

- `POST /api/modules/member-forum/posts`
  - Auth required
  - Validates write permission for target space
  - Creates post

- `GET /api/modules/member-forum/posts/[id]`
  - Returns post details + visible comments

- `POST /api/modules/member-forum/posts/[id]/comments`
  - Auth required
  - Validates post unlocked + writer permission
  - Supports optional `parent_comment_id`

- `POST /api/modules/member-forum/posts/[id]/lock`
  - Host-only (or future space moderator role)
  - Toggles lock state

- `DELETE /api/modules/member-forum/posts/[id]`
  - Owner or host soft-delete (`is_deleted=true`)

- `DELETE /api/modules/member-forum/comments/[id]`
  - Owner or host soft-delete (`is_deleted=true`)

- `GET /api/modules/member-forum/summary`
  - Card summary (example: visible spaces, recent posts count, latest post)

Auth and authorization:
- Reads may be anonymous for public spaces only
- All writes require signed-in user and entitlement checks
- APIs enforce authz; RLS provides DB-level enforcement parity

## Portal RPC (optional)
Not required for v1.

## Allowed iframe origins (optional)
N/A for v1 (portal-owned module route).

## Acceptance criteria
- [ ] Module is registered in `modules/registry.json`
- [ ] Module appears on `people-tools`
- [ ] New migration creates forum tables and indexes
- [ ] RLS enforces read matrix:
  - public spaces readable by anon/authenticated users
  - member spaces readable by users with active `dao-member`
  - cohort spaces readable by users with active `cohort-access`
- [ ] RLS/API enforce write matrix:
  - no public writes
  - member writes require active `dao-member`
  - cohort writes require active `cohort-access`
- [ ] User can create post in authorized space
- [ ] User can comment on authorized, unlocked posts
- [ ] Unauthorized reads/writes return proper denied responses
- [ ] Host can lock/unlock and soft-delete content
- [ ] Summary endpoint renders on module card
- [ ] Lint passes

## Testing / seed data (required for DB-backed features)
- [ ] Seed plan: create deterministic spaces and users to cover public/member/cohort tiers
- [ ] Staging seed added (idempotent; safe to run repeatedly)
  - Location: `supabase/seeds/staging/`
  - Uses deterministic IDs and/or upserts
- [ ] Personas covered:
  - anonymous visitor
  - signed-in no-entitlement user
  - `dao-member` entitled user
  - `cohort-access` entitled user
  - `host` role user
- [ ] Smoke tests defined:
  - API checks:
    - anonymous can read public spaces/posts
    - anonymous cannot write anywhere
    - non-entitled signed-in user blocked from member/cohort writes
    - `dao-member` user can write in member spaces only
    - `cohort-access` user can write in cohort spaces (and read cohort spaces)
    - host lock/delete actions succeed
  - Optional Playwright flow:
    - browse public feed logged out
    - sign in and post in authorized space
    - verify locked post blocks new comments

## Automation consent
- [x] OK to auto-generate a PR for this spec
