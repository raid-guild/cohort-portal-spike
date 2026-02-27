# Notification Manager

Notification Manager is a portal-owned module that lets signed-in users control
email notifications for pilot topics and cadence.

## Key files
- `src/modules/notification-manager/NotificationManager.tsx` - client UI for loading, editing, and saving preferences.
- `src/app/modules/notification-manager/page.tsx` - route container page.
- `src/app/api/me/notification-preferences/route.ts` - authenticated read/write preferences API.
- `src/app/api/modules/notification-manager/summary/route.ts` - compact module card summary.
- `supabase/seeds/staging/0011_notification_manager_fixtures.sql` - deterministic staging fixture rows.

## Implementation notes
- Defaults remain disabled until explicit user opt-in.
- API auth uses user bearer tokens from Supabase session.
- Summary endpoint uses the same disabled-by-default behavior when no row exists.
