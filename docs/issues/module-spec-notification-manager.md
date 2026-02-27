# module-spec: Notification Manager

## Module ID
`notification-manager`

## Owner / contact
`@dekanbro`

## Problem / user value
Authenticated users need a clear, self-serve way to control notification preferences (topics + cadence + email on/off) during the pilot.  
Without a user-facing manager, notifications are operationally enabled in backend but not user-controllable, which creates adoption and trust risk.

Primary users:
- Cohort/DAO members receiving updates
- Hosts validating notification pilot behavior

## Scope (what’s in / out)
In scope (v1):
- UI module for editing notification preferences:
  - email enabled toggle
  - cadence (`daily` | `weekly`)
  - topic toggles (`blog`, `forum`, `grimoire`)
- Read/write integration with `GET/POST /api/me/notification-preferences`
- Module card summary showing current preference state
- Safe defaults: all notifications disabled unless user opts in

Out of scope (later):
- Unsubscribe links in email headers/body
- Per-space forum granularity
- AI newsletter composition controls
- Delivery history UI

## UX / surfaces
- Surfaces:
  - `me-tools` (primary)
  - optional `start-here` card placement if we want higher discoverability during pilot
- Presentation:
  - `presentation.mode = "page"` (or dialog acceptable if preferred by design)
  - `presentation.layout = "default"`
- States:
  - loading
  - unauthorized (prompt sign-in)
  - loaded with current preferences
  - saving
  - save success/error toast/message

## Card layout
`default`

## Summary layout
`compact`

## Summary widget mode (if widget)
`not-applicable`

## Storage preference
`new tables + migrations` (already implemented in `public.user_notification_preferences`)

## Data model (fields)
Existing table:
- `user_notification_preferences`
  - `user_id uuid` (pk)
  - `email_enabled boolean`
  - `cadence text` (`daily` | `weekly`)
  - `blog_enabled boolean`
  - `forum_enabled boolean`
  - `grimoire_enabled boolean`
  - `last_digest_sent_at timestamptz null`
  - `created_at`, `updated_at`

## API requirements
Use existing endpoints:
- `GET /api/me/notification-preferences`
  - auth required
  - returns current preferences or default (all disabled)
- `POST /api/me/notification-preferences`
  - auth required
  - partial/full updates for toggles + cadence

Add module summary endpoint:
- `GET /api/modules/notification-manager/summary`
  - auth required
  - returns compact status for module card

## Portal RPC (optional)
Not required for v1.

## Allowed iframe origins (optional)
Not applicable (portal-owned module).

## Acceptance criteria
- [ ] Module is registered in `modules/registry.json`
- [ ] Module page renders for signed-in users
- [ ] Notification preferences can be toggled and persisted
- [ ] Defaults are disabled until explicit user opt-in
- [ ] Summary endpoint renders on the module card
- [ ] Lint passes

## Testing / seed data (required for DB-backed features)
- [ ] Seed plan: minimum test users with profiles + emails
- [ ] Staging seed added (idempotent; safe to run repeatedly)
  - Location: `supabase/seeds/staging/`
  - Uses deterministic IDs and/or upserts
- [ ] Personas covered: authenticated user, host reviewer
- [ ] Smoke tests defined (at least one):
  - API checks:
    - `GET /api/me/notification-preferences` returns defaults disabled
    - `POST /api/me/notification-preferences` persists updates
  - UI flow:
    - toggle settings, refresh page, values persist

## Automation consent
- [ ] OK to auto-generate a PR for this spec
