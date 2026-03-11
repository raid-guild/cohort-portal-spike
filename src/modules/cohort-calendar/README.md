# Cohort Calendar

Portal-owned calendar module for cohort sessions, brown bags, and community calls.

## Key files

- `src/app/modules/cohort-calendar/page.tsx`: module page entrypoint.
- `src/modules/cohort-calendar/CohortCalendarModule.tsx`: client UI for agenda/month views, event modal, and host event creation.
- `src/app/api/modules/cohort-calendar/*`: events, summary, RSVP, and ICS export APIs.
- `src/modules/cohort-calendar/shared.ts`: shared event type metadata and calendar export helpers.
- `supabase/migrations/0043_cohort_calendar.sql`: tables and policies.

## Notes

- Read access is authenticated, with event visibility filtered by entitlement for `members` and `cohort` events.
- Host-only event creation is enforced in the API.
- ICS download and Google Calendar export use the same shared event payload.
