# Event Persistence (v1)

Status: Implemented baseline
Owner: Portal Core
Last updated: 2026-02-27

## Why
We need a portal-owned event bus so modules can emit domain events once and let multiple consumers react independently (badges, notifications, timelines, analytics) without direct module-to-module wiring.

## Goals
- Define a stable, minimal event envelope for all modules.
- Keep producer integration low-friction: one shared helper + registry-declared kinds.
- Persist events for replayable automation (not only transient UI messaging).
- Enforce emit authorization centrally.

## Non-goals (v1)
- Realtime subscriptions.
- Per-kind strict JSON schema validation.
- Exactly-once global delivery guarantees.

## Event Envelope
```json
{
  "moduleId": "guild-grimoire",
  "kind": "core.guild_grimoire.note_created",
  "actorId": "uuid",
  "subject": { "type": "guild_grimoire_note", "id": "uuid" },
  "visibility": "authenticated",
  "data": { "contentType": "text" },
  "occurredAt": "2026-02-27T18:07:00.000Z",
  "source": "module:guild-grimoire",
  "dedupeKey": "note:<uuid>:created"
}
```

Fields:
- `moduleId` (required): producing module id.
- `kind` (required): event kind string.
- `actorId` (optional): user responsible for the event.
- `subject` (optional): object reference, usually `{ type, id }`.
- `visibility` (optional): `public` | `authenticated` | `private` (defaults to `authenticated`).
- `data` (optional): free-form JSON payload.
- `occurredAt` (optional): ISO datetime; defaults to now.
- `source` (optional): provenance string; defaults to `module:<moduleId>`.
- `dedupeKey` (optional): producer-scoped idempotency key.

## Naming Rules
- Core events: `core.<domain>.<action>`
  - Example: `core.guild_grimoire.note_created`
- Custom events: `custom.<moduleId>.<action>`
  - Example: `custom.guild-grimoire.import_completed`

Validation rules:
- `custom.*` kinds must start with `custom.<moduleId>.`.
- `core.*` kinds are allowed only when explicitly declared by the module.

## Registry Capabilities
Declare allowed event kinds in `modules/registry.json`:

```json
{
  "capabilities": {
    "events": {
      "emit": {
        "kinds": [
          "core.guild_grimoire.note_created",
          "custom.guild-grimoire.import_completed"
        ],
        "requiresUserAuth": true
      }
    }
  }
}
```

Notes:
- New modules should only need this declaration plus helper calls in write routes.
- Consumers should subscribe by `kind`; producers remain decoupled.

## Storage
Migration: `supabase/migrations/0031_portal_events.sql`

Table: `public.portal_events`
- `id uuid pk`
- `module_id text`
- `kind text`
- `actor_id uuid null`
- `subject jsonb null`
- `data jsonb null`
- `visibility text`
- `occurred_at timestamptz`
- `source text`
- `dedupe_key text null`
- `created_at timestamptz`

Indexes:
- `occurred_at desc`
- `(kind, occurred_at desc)`
- `(module_id, occurred_at desc)`
- `(actor_id, occurred_at desc)`
- unique `(module_id, dedupe_key)` when `dedupe_key` is present

## API + Helper
- API: `POST /api/portal-events`
  - auth: user bearer token or `x-module-id` + `x-module-key`
  - validates emit permissions from registry
  - validates kind naming rules
- Helper: `emitPortalEvent(...)` in `src/lib/portal-events.ts`
  - use from server mutation routes to emit domain events directly

## Current Scope
This v1 ships event production and persistence. Consumers (badge automation, digests, etc.) should be implemented as independent readers over `portal_events`.
