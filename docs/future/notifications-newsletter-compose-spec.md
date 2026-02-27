# Notifications Newsletter Compose (n8n) - Proposed

Status: Draft
Owner: Portal Core
Last updated: 2026-02-27

## Goal
Move from plain digest line-items to AI-composed newsletter content by calling an n8n webhook, similar to Daily Brief patterns.

## Current state
- Digest events are collected in `enqueueNotificationDigests(...)` and queued as `notification.digest.ready`.
- SendGrid sends basic itemized content directly from outbox payload.

## Proposed architecture
1. Digest collector queues `notification.digest.compose` instead of `notification.digest.ready`.
2. Composer worker calls n8n webhook with user context + digest items.
3. Composer writes a new outbox event `notification.digest.ready` containing:
   - `subject`
   - `preheader` (optional)
   - `textBody`
   - `htmlBody` (optional)
4. Existing SendGrid processor sends this composed payload.

This keeps responsibilities separated:
- Collection: event filtering and eligibility
- Composition: AI summarization and editorial tone
- Delivery: retries, SendGrid integration, sent markers

## Suggested webhook endpoint
- `POST ${NOTIFICATION_DIGEST_WEBHOOK_URL}`
- Optional auth header: `x-notification-webhook-key: ${NOTIFICATION_DIGEST_WEBHOOK_KEY}`

## Request payload contract
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "cadence": "daily"
  },
  "window": {
    "start": "2026-02-26T13:30:00.000Z",
    "end": "2026-02-27T13:30:00.000Z"
  },
  "items": [
    {
      "kind": "core.dao_blog.post_published",
      "title": "Post title",
      "summary": "Short summary",
      "href": "/modules/dao-blog/some-slug",
      "occurredAt": "2026-02-27T10:22:00.000Z"
    }
  ],
  "style": {
    "voice": "RaidGuild",
    "maxWords": 350
  }
}
```

## Response payload contract
```json
{
  "subject": "Your RaidGuild daily digest",
  "preheader": "3 updates from blog, forum, and grimoire",
  "textBody": "Plain text fallback",
  "htmlBody": "<h1>...</h1><p>...</p>"
}
```

Validation requirements:
- `subject` required
- at least one of `textBody` or `htmlBody` required
- response size limits should be enforced before enqueueing

## New event types
- `notification.digest.compose` (input to composer)
- `notification.digest.ready` (output from composer; final send payload)

## Failure strategy
- If n8n call fails:
  - keep compose event pending with backoff (reuse outbox retry semantics), or
  - fallback to current plain digest composition for continuity.
- Never block module writes; this is async only.

## Data safety
- Do not include secrets or raw private content in webhook payload.
- Keep only summary-level fields for private events unless user is owner.
- Enforce max item count before composition.

## Rollout plan
1. Add compose event type support in outbox processor.
2. Introduce composer route/worker with n8n call.
3. Ship behind env gate:
   - `NOTIFICATION_DIGEST_COMPOSE_ENABLED=true`
4. Pilot with small allowlist of users.
5. Monitor send volume, failure rate, and quality before broad enablement.

## Env vars (proposed)
- `NOTIFICATION_DIGEST_COMPOSE_ENABLED`
- `NOTIFICATION_DIGEST_WEBHOOK_URL`
- `NOTIFICATION_DIGEST_WEBHOOK_KEY`
