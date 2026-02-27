# Feedback Center

Feedback Center is a portal-owned module for collecting product feedback, bug reports,
feature requests, and module requests in one place.

## Key files
- `src/modules/feedback-center/FeedbackCenter.tsx` - client UI with submit, my reports, and triage tabs.
- `src/app/modules/feedback-center/page.tsx` - route container page.
- `src/app/api/modules/feedback-center/items/*` - CRUD-ish API for submitting/listing/updating feedback items.
- `src/app/api/modules/feedback-center/summary/route.ts` - module card summary counts.
- `supabase/migrations/0031_feedback_center.sql` - schema, indexes, and RLS policies.
- `supabase/seeds/staging/0010_feedback_center_fixtures.sql` - deterministic staging seed fixtures.

## Implementation notes
- Any signed-in user can submit and view their own feedback.
- Host/admin roles can access triage (global list + status/priority/notes updates).
- Type-specific required fields are enforced in API validation and SQL constraints.
