# Polling Module

Portal-owned polling engine for structured single-choice votes.

## Key files
- `src/app/modules/polling/page.tsx` - module page shell.
- `src/modules/polling/PollingModule.tsx` - client UI for list/detail/vote/close actions.
- `src/app/api/modules/polling/` - poll APIs (`list/create/detail/vote/close/summary`).
- `src/app/api/modules/polling/lib.ts` - shared auth, eligibility, and poll state helpers.
- `supabase/migrations/0037_polling.sql` - polling schema migration.

## Notes
- Eligibility rules are evaluated in API handlers for actions: `create`, `vote`, `view_results`.
- Vote events, poll creation events, and poll close events emit via `portal_events`.
- Summary endpoint returns compact stats for module cards.
