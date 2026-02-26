# DAO Blog

DAO Blog is a portal-owned publishing module for public posts with a host-reviewed
publish workflow.

## Key files
- `src/app/modules/dao-blog/` - index, permalink, and manage/editor routes.
- `src/modules/dao-blog/` - client UI for index, manage, editor, and referral capture.
- `src/app/api/modules/dao-blog/` - module API routes and auth/transition logic.
- `supabase/migrations/0030_dao_blog.sql` - schema, indexes, and RLS policies.
- `supabase/seeds/staging/0009_dao_blog_fixtures.sql` - deterministic staging fixtures.
