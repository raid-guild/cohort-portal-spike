# Event Persistence (Proposed)

Status: Draft
Owner: TBD
Last updated: 2026-02-11

## Why
We want a standard, portal-owned place for modules to emit and read events so other
modules can react without tight coupling. This enables shared timelines, cross-module
signals, and future realtime without forcing direct module-to-module communication.

## Goals
- Provide a stable, minimal event envelope.
- Support persisted events with visibility controls.
- Keep schema enforcement light to avoid blocking module builders.
- Allow both core (platform) and custom (module) event kinds.

## Non-goals (v0)
- Full schema validation per event kind.
- Cross-tab realtime delivery.
- Event-driven workflows or background jobs.

## Event Envelope (v0)
```json
{
  "kind": "core.bounty.created",
  "actorId": "uuid",
  "subject": { "type": "bounty", "id": "uuid" },
  "visibility": "public",
  "data": { "title": "Build X" }
}
```

Fields:
- `kind`: string
- `actorId`: optional user id
- `subject`: optional object, at least `{ type, id }`
- `visibility`: `public` | `authenticated` | `private`
- `data`: optional JSON payload (no strict schema enforced at v0)

## Naming rules
- Core events: `core.<domain>.<action>`
  - Example: `core.bounty.created`
- Custom events: `custom.<moduleId>.<action>`
  - Example: `custom.skills-explorer.graph_built`
- Emit enforcement:
  - If `kind` starts with `custom.`, it must match `custom.<moduleId>.`
  - If `kind` starts with `core.`, it must be on an allowlist

## Registry capabilities (proposed)
Add to `modules/registry.json`:
```json
{
  "capabilities": {
    "events": {
      "emit": {
        "kinds": ["core.bounty.created", "custom.bounty-board.note_added"],
        "requiresUserAuth": true
      },
      "read": {
        "kinds": ["core.bounty.created", "core.badge.awarded"],
        "visibility": ["public", "authenticated"],
        "requiresUserAuth": false,
        "allowedRoles": ["host"]
      }
    }
  }
}
```

Notes:
- Emit controls which event kinds a module may create.
- Read controls which event kinds a module may access.
- These are authorization hints enforced by portal APIs.

## Table (proposed)
```sql
create table public.portal_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  actor_id uuid,
  subject jsonb,
  data jsonb,
  visibility text not null default 'public',
  created_at timestamptz not null default now()
);
```

## API surface (proposed)
- `POST /api/portal-events`
  - Accepts the event envelope.
  - Auth via user token or module key.
  - Enforces registry `capabilities.events.emit`.
- `GET /api/portal-events`
  - Filters by `kind`, `subject`, `actorId`, `visibility`.
  - Enforces registry `capabilities.events.read`.

## Initial core event kinds (candidate)
- `core.announcement.published`
- `core.bounty.created`
- `core.bounty.claimed`
- `core.badge.awarded`
- `core.cohort.application_approved`

## Timeline integration (candidate)
- Raider Timeline queries its own `timeline_entries`.
- It also queries `portal_events` for allowed kinds.
- The UI merges both lists by `created_at`.

## Open questions
- Should `actorId` be required for all authenticated emits?
- Should `subject` be required for `core.*` kinds?
- Do we need a `source` field for provenance and dedupe?
