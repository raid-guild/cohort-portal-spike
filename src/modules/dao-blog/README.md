# DAO Blog

DAO Blog is a portal-owned publishing module for public posts with a host-reviewed
publish workflow.

## Key files
- `src/app/modules/dao-blog/` - index, permalink, and manage/editor routes.
- `src/modules/dao-blog/` - client UI for index, manage, editor, and referral capture.
- `src/app/api/modules/dao-blog/` - module API routes and auth/transition logic.
- `supabase/migrations/0030_dao_blog.sql` - schema, indexes, and RLS policies.
- `supabase/seeds/staging/0009_dao_blog_fixtures.sql` - deterministic staging fixtures.

## Implementation notes
- Public reads are limited to published posts; draft/review flows require authenticated author or host access.
- Module cards read from `/api/modules/dao-blog/summary` and are wired via `modules/registry.json`.
- Publish lifecycle is `draft -> in_review -> published`, with host approval/rejection transitions.
- External systems can create posts through `/api/modules/dao-blog/ingest` using `x-dao-blog-api-key`.
- Ingested posts support optional external author display fields stored directly on the post.
- External ingest also requires `DAO_BLOG_INGEST_API_KEY` and `DAO_BLOG_INGEST_USER_ID` in the server environment.
- `DAO_BLOG_INGEST_USER_ID` must be a valid Supabase auth user UUID used as the internal owner for ingested posts.
- The current ingest rate limit is in-memory and per-process, so it is best-effort only in serverless or multi-instance deployments.
