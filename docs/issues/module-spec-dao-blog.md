# module-spec: DAO Blog Platform

## Module ID
`dao-blog`

## Owner / contact
`@dekanbro` (update if different)

## Problem / user value
RaidGuild needs a simple publishing surface for announcements, thought pieces, and project updates that are publicly readable and easy to share externally. Today content is scattered across social posts and docs without durable permalink structure.

Primary users:
- Readers: anyone (anonymous or signed-in)
- Authors: users with active `dao-member` entitlement
- Reviewers/approvers: hosts

Core value:
- Public reading with durable permalink URLs
- Strong social sharing via unfurl metadata (Open Graph/Twitter)
- Lightweight editorial workflow without comment moderation overhead
- Reuse existing referral capture infra (`public.email_referrals`) for blog-driven signups

## Scope (what's in / out)
In scope (v1):
- Public blog index and public post pages
- Post model with title, slug, summary, header image, markdown body
- Rich markdown editor for authors
- DAO-member-only create/edit/publish permissions
- Publish workflow with host review/approval
- Publish states (`draft`, `in_review`, `published`)
- Direct permalink routing by slug
- Unfurl metadata on permalink pages
- No comments
- Blog referral capture via existing `email_referrals`

Out of scope (future):
- Reactions/comments
- Scheduled publishing
- Multi-author editorial approvals
- Localization and multi-language variants
- Newsletter/email distribution sync

## UX / surfaces
Surfaces:
- Public post pages are readable by all users (including anonymous)
- Discovery/read flow appears on `start-here`
- Publishing flow appears on `member-tools`
- Authoring actions available only to signed-in users with active `dao-member`

Experience:
- Public index route: `/modules/dao-blog`
- Public permalink route: `/modules/dao-blog/[slug]`
- Author dashboard route: `/modules/dao-blog/manage`
- Editor route: `/modules/dao-blog/manage/new` and `/modules/dao-blog/manage/[id]`

Key UI states:
- Anonymous reader sees published posts only
- Non-dao-member sees read-only experience and blocked author actions
- Dao-member can create draft, edit own drafts, submit for review
- Host can review and approve/reject submissions
- Empty state for no published posts

Card sizing intent:
- `presentation.layout = wide`
- Summary card shows latest published posts with title + publish date

## Card layout
`wide`

## Summary layout
`excerpt`

## Summary widget mode (if widget)
`not-applicable`

## Storage preference
`new tables + migrations`

## Data model (fields)
Proposed table:

1) `public.dao_blog_posts`
- `id uuid pk default gen_random_uuid()`
- `title text not null`
- `slug text not null unique` (lowercase kebab-case)
- `summary text not null` (target max 280 chars)
- `header_image_url text not null`
- `body_md text not null`
- `status text not null default 'draft'` check in (`draft`, `in_review`, `published`)
- `published_at timestamptz null`
- `author_user_id uuid not null`
- `review_submitted_at timestamptz null`
- `reviewed_at timestamptz null`
- `reviewed_by uuid null`
- `review_notes text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `deleted_at timestamptz null`

Indexes:
- unique index on `slug`
- index on `status, published_at desc`
- index on `author_user_id`

Validation notes:
- `summary` required for cards + SEO descriptions
- `header_image_url` required and used for card + OG image fallback
- Slug immutable after create in v1 (no edits, no redirects)
- Header image constraints (v1 sensible defaults):
  - accepted mime types: `image/jpeg`, `image/png`, `image/webp`
  - max file size: 5 MB
  - recommended aspect ratio: 1.91:1 (minimum 1200x630) for social cards

Access model:
- Read published posts: public/anonymous allowed
- Draft read/write:
  - author can read/edit own drafts
  - host can read/edit any draft and review state
- submit for review: author only (including host when acting as author)
- approve/reject publish: `host` role only
- Enforce in API and RLS

## API requirements
Module endpoints (portal-owned):

- `GET /api/modules/dao-blog/posts`
  - Public endpoint
  - Query: `cursor`, `limit`, optional `author`, optional `tag` (future-safe)
  - Returns published posts only

- `GET /api/modules/dao-blog/posts/[slug]`
  - Public endpoint
  - Returns one published post by slug

- `POST /api/modules/dao-blog/posts`
  - Auth required + active `dao-member`
  - Creates draft post

- `PATCH /api/modules/dao-blog/posts/[id]`
  - Auth required
  - Author can edit own draft; host can edit any post
  - Slug cannot be changed after create

- `POST /api/modules/dao-blog/posts/[id]/submit-review`
  - Auth required (author only)
  - For non-host authors: active `dao-member` required
  - Host authors use the same transition path (no direct publish shortcut)
  - Sets `status='in_review'` and `review_submitted_at=now()`

- `POST /api/modules/dao-blog/posts/[id]/approve`
  - Auth required + `host` role
  - Valid only when current status is `in_review`
  - Sets `status='published'`, `published_at=now()`, reviewer metadata

- `POST /api/modules/dao-blog/posts/[id]/reject`
  - Auth required + `host` role
  - Sets `status='draft'` with `review_notes`

- `POST /api/modules/dao-blog/posts/[id]/unpublish`
  - Auth required + `host` role
  - Sets `status='draft'`

- `GET /api/modules/dao-blog/summary`
  - Public summary for module card (latest post snippets)

- `POST /api/email-referrals`
  - Reuse existing endpoint/table for blog CTA capture
  - `referral` format: `dao-blog:<slug>` to attribute source post

Metadata/unfurl requirements:
- Permalink page must generate dynamic metadata with:
  - canonical URL (production origin)
  - Open Graph (`og:title`, `og:description`, `og:image`, `og:url`, `og:type=article`)
  - Twitter card tags (`summary_large_image`)
- Return correct status for missing/unpublished slug (404)

SEO requirements:
- published pages: indexable (`index,follow`)
- draft/review/manage routes: `noindex,nofollow`
- include `article:published_time` and `article:author` where available

## Portal RPC (optional)
Not required for v1.

## Allowed iframe origins (optional)
N/A for v1 (portal-owned module route)

## Acceptance criteria
- [ ] Module is registered in `modules/registry.json`
- [ ] Public index page renders published posts for anonymous users
- [ ] Public permalink route exists at `/modules/dao-blog/[slug]`
- [ ] Permalink pages include Open Graph + Twitter metadata for unfurls
- [ ] Slugs are immutable after create
- [ ] Only active `dao-member` users can create and edit their own draft content
- [ ] Host override can edit any post
- [ ] Publish requires host review flow (`submit-review` -> `approve`/`reject`)
- [ ] No direct `draft` -> `published` transition is allowed (including hosts)
- [ ] Non-dao-member users cannot access authoring endpoints
- [ ] Editor supports rich markdown authoring and persisted markdown body
- [ ] Header image + summary are required before publish
- [ ] Header image upload enforces mime/size constraints
- [ ] No comments UI or comments APIs are present
- [ ] Blog referral capture uses existing `email_referrals` table with post-based referral key
- [ ] Summary endpoint renders on module card
- [ ] Lint passes

## Testing / seed data (required for DB-backed features)
- [ ] Seed plan: deterministic published + draft posts with different authors
- [ ] Staging seed added (idempotent; safe to run repeatedly)
  - Location: `supabase/seeds/staging/`
  - Uses deterministic IDs and/or upserts
- [ ] Personas covered:
  - anonymous reader
  - signed-in non-dao-member
  - dao-member author
  - host reviewer
- [ ] Smoke tests defined:
  - API checks:
    - anonymous can list/read published posts
    - anonymous cannot create or edit posts
    - non-dao-member gets 403 on authoring endpoints
    - dao-member can create/edit own draft and submit for review
    - host can approve/reject and unpublish
    - dao-member cannot edit another member's draft
    - permalink for published slug returns metadata tags
    - referral signup writes to `email_referrals` with `dao-blog:<slug>`
  - Optional Playwright flow:
    - dao-member writes draft, submits review, host approves, reader opens public permalink

## Automation consent
- [x] OK to auto-generate a PR for this spec
