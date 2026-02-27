# Events & Automations

This document tracks portal-owned automations powered by `public.portal_events`.

## Current pipeline
1. Module APIs emit domain events to `public.portal_events`.
2. Consumers process those events asynchronously.
3. Notification digests are queued to `public.integration_outbox`.
4. SendGrid outbox processor sends and retries with backoff.

## Shipped consumers

### Badge consumer: first grimoire note
- Consumer id: `badges:first-grimoire-note`
- Source event kind: `core.guild_grimoire.note_created`
- Effect: awards `grimoire-first-note` badge
- Idempotency:
  - `user_badges` primary key `(user_id, badge_id)`
  - `portal_event_consumptions` primary key `(consumer_id, event_id)`

Cron endpoint:
- `GET /api/integrations/events/process`
- Auth: `Authorization: Bearer ${CRON_SECRET}`

## Notification foundation

### User preferences
Table: `public.user_notification_preferences`

API:
- `GET /api/me/notification-preferences`
- `POST /api/me/notification-preferences`

Payload:
```json
{
  "emailEnabled": false,
  "cadence": "daily",
  "blogEnabled": false,
  "forumEnabled": false,
  "grimoireEnabled": false
}
```

Defaults are opt-in (all disabled) during pilot.

### Digest enqueue
Cron endpoint:
- `GET /api/integrations/notifications/enqueue`
- Auth: `Authorization: Bearer ${CRON_SECRET}`

Behavior:
- Finds users due for digest (`daily` or `weekly`)
- Pulls matching events from `portal_events`
- Writes `notification.digest.ready` rows to `integration_outbox`
- Uses `digest_key` for dedupe

### SendGrid processing
Existing processor now supports:
- `email_referral.created`
- `notification.digest.ready`

On successful digest send, it updates `last_digest_sent_at` for the user.

## Vercel cron schedule
- `0 13 * * *` -> `/api/integrations/events/process`
- `30 13 * * *` -> `/api/integrations/notifications/enqueue`
- `0 14 * * *` -> `/api/integrations/sendgrid/process`
