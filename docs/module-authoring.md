# Module Authoring Guide

This guide explains how to add a module to the portal and (optionally) store module data.

## 1) Add a registry entry
Edit `modules/registry.json` and add a new module entry:

```json
{
  "id": "skills-explorer",
  "title": "Skills Explorer",
  "description": "Visualize cohort skills and explore talent clusters.",
  "lane": "profiles",
  "type": "link",
  "url": "https://example.com/skills",
  "status": "planned",
  "owner": { "name": "Profiles Lane", "contact": "discord:@profiles" },
  "requiresAuth": false,
  "tags": ["people-tools", "skills", "directory"],
  "presentation": {
    "mode": "dialog",
    "trigger": "button",
    "dialog": { "size": "lg" },
    "iframe": { "height": 720 }
  }
}
```

Notes:
- `id` must be unique and URL safe.
- `type` is `link` or `embed`.
- Use tags like `start-here`, `people-tools`, `profile-tools-public`, `me-tools` to surface modules.
- Surfaces: home uses `start-here`, people uses `people-tools`, profiles use `profile-tools-public`, and `/me` uses `me-tools`.
- Additional role/entitlement surfaces:
  - `/host` uses `host-tools` and is intended for host-only operational views.
  - `/member` uses `member-tools` and is intended for DAO-member views.
  - Keep real authorization in `tags: ["hosts"]` and/or `access.entitlement`; surface tags are for placement.
- Pattern for gated experiences:
  - Put onboarding/claim flows in broadly available surfaces like `/me` (example: DAO claim).
  - Put ongoing privileged workflows and dashboards in gated surfaces (example: `/member`).
  - Do not rely on surface placement alone; enforce role/entitlement in module APIs.
- Add a module-level README at `src/modules/<module-id>/README.md` with purpose, key files, and notes.
- Set `presentation.action` to `none` if you want a summary-only card.
- Tag a module with `hosts` to make it host-only (hidden for non-hosts).
- Host-only tags only control portal visibility. External modules must enforce their own access.
- Set `presentation.layout` explicitly for predictable card sizing in dashboard surfaces:
  - `"compact"`: small stats/data card.
  - `"default"`: standard stackable card.
  - `"wide"`: full-width card.
- If layout is omitted, the portal treats it as `"default"`.
- Use `presentation.height: "double"` to give a module card extra vertical space.

## Module isolation
Modules are treated as isolated surfaces. When a module opens in a dialog, it loads in
an iframe (even for portal-owned modules) to keep behavior consistent with third-party
modules and to avoid leaking state across surfaces.

If a module needs portal context (for example, the auth token or a profile refresh),
use portal-owned APIs and messaging between the iframe and parent window.

## Portal RPC (message bus v0)
The portal supports a minimal request/response RPC bridge over `window.postMessage`.
Modules can opt in to this contract to request common portal actions.

Envelope:
```ts
type PortalRpcRequest = {
  protocol: "rg-portal-rpc";
  version: 1;
  type: "request";
  id: string;
  moduleId: string;
  action: string;
  payload?: any;
};

type PortalRpcResponse = {
  protocol: "rg-portal-rpc";
  version: 1;
  type: "response";
  id: string;
  ok: boolean;
  result?: any;
  error?: { code: string; message: string };
};
```

### Allowed actions (v0)
- `auth.getToken`
- `profile.refresh`
- `ui.toast`
- `module.open`

### Cross-module navigation pattern
Prefer cross-module navigation over direct cross-module table writes.

- Keep each module authoritative for its own write APIs and tables.
- From the source module, call `module.open` with the destination module ID.
- Pass lightweight intent in `payload.params` (for example `mode=audio&source=daily-brief`) so the destination module can preselect UI state.
- Add `capabilities.portalRpc.allowedActions` for `module.open` on the source module in `modules/registry.json`.

Example:
```ts
const portalRpc = createPortalRpcClient("daily-brief");
await portalRpc.call("module.open", {
  moduleId: "guild-grimoire",
  surface: "page",
  params: { mode: "audio", source: "daily-brief" },
});
```

### Capabilities + origins
Add `capabilities.portalRpc.allowedActions` and `allowedOrigins` in the registry entry.
The portal broker enforces both.

Example:
```json
{
  "allowedOrigins": ["https://portal.raidguild.org"],
  "capabilities": {
    "portalRpc": {
      "allowedActions": ["auth.getToken", "profile.refresh", "ui.toast"]
    }
  }
}
```

### Module helper (portal-owned)
Use `src/modules/_shared/portalRpc.ts` to send requests from a module:
```ts
const portalRpc = createPortalRpcClient("raider-timeline");
await portalRpc("profile.refresh", { handle: "dekanbro" });
```

If RPC fails (for example, when running standalone), modules should fall back to
local refresh signals (see `emitLocalProfileRefresh`).

## Domain events (persisted bus v1)
Use the persisted event bus for backend automations and cross-module reactions
(for example: badges, notifications, timelines), not the iframe RPC bus.

### Event contract
Emit events with:
- `moduleId` (required)
- `kind` (required)
- `actorId` (optional)
- `subject` (optional object, usually `{ type, id }`)
- `visibility` (`public` | `authenticated` | `private`, default `authenticated`)
- `data` (optional JSON payload)
- `occurredAt` (optional ISO datetime)
- `source` (optional provenance string)
- `dedupeKey` (optional idempotency key)

Naming:
- Core: `core.<domain>.<action>`
- Custom: `custom.<moduleId>.<action>`

Rules:
- `custom.*` must match `custom.<moduleId>.*`
- modules may emit only kinds declared in registry

### Registry declaration
Add emit capabilities in `modules/registry.json`:
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

### Server helper usage
Emit from server mutation routes with `src/lib/portal-events.ts`:
```ts
import { emitPortalEvent } from "@/lib/portal-events";

await emitPortalEvent({
  moduleId: "guild-grimoire",
  kind: "core.guild_grimoire.note_created",
  actorId: auth.userId,
  subject: { type: "guild_grimoire_note", id: noteId },
  visibility: "authenticated",
  data: { contentType: "text" },
  dedupeKey: `note:${noteId}:created`,
});
```

Guidance:
- Emit after successful writes.
- Start fail-open (log on emit errors, do not fail primary user write path).
- Keep consumers decoupled; avoid direct module-to-module writes.

## Capabilities (contract metadata)
Use `capabilities` to declare what a module is allowed to do. Some capabilities are
enforced by portal APIs/brokers (for example `portalRpc` and `events.emit`), while others
remain contract metadata for shared expectations.

Example:
```json
{
  "capabilities": {
    "dataWrite": { "requiresKey": true },
    "profileWrite": { "fields": ["bio", "links"], "requiresKey": true },
    "announcementsWrite": { "requiresUserAuth": true, "allowedRoles": ["host"] },
    "aiGenerate": { "requiresUserAuth": true, "provider": "venice" }
  }
}
```

## Access rules (entitlements)
Use `access.entitlement` to gate a module behind a subscription or entitlement.
This is enforced in portal surfaces (module cards) and should be backed by the
`public.entitlements` table. Entitlements are synced by the billing webhook,
so modules that require paid access should also enforce authorization on their
own API surfaces.

For guidance on when to use roles vs entitlements, see
`docs/roles-vs-entitlements.md`.

Example:
```json
{
  "access": {
    "requiresAuth": true,
    "entitlement": "cohort-access"
  }
}
```

## 1b) (Optional) Add a module summary
If you want the module card to show a summary, add a `summary` block.

```json
{
  "summary": {
    "source": "api",
    "title": "Cohort Skills",
    "endpoint": "/api/modules/skills-explorer/summary"
  }
}
```

The summary endpoint should return:
```json
{
  "title": "Cohort Skills",
  "items": [
    { "label": "People", "value": "42" },
    { "label": "Unique skills", "value": "18" }
  ]
}
```

### Summary presentation options
Optional fields for summary layout:
- `layout`: `list` (default), `excerpt`, `compact`, or `widget`
- `maxItems`: limit the number of items shown
- `truncate`: max character length for values or excerpts
- `showTitle`: boolean to show/hide the summary title
- `progressKey`: render a progress bar for the matching item label
- `imageKey`: render a circular thumbnail for the matching item label (compact layout)
- `widget`: configuration for dynamic summary widgets when `layout` is `widget`

### Summary widget primitive
Use `layout: "widget"` when a summary card should render dynamic content.

Supported widget modes:
- `mode: "data"`: endpoint returns generic `widget.data`; portal renders a supported widget component.
- `mode: "embed"`: portal renders an iframe from `widget.src` (use for third-party mini apps).

Widget config shape:
```json
{
  "summary": {
    "source": "api",
    "endpoint": "/api/modules/example/summary",
    "layout": "widget",
    "widget": {
      "mode": "data",
      "type": "chart",
      "variant": "force-graph",
      "height": 220
    }
  }
}
```

Endpoint response shape (with fallback):
```json
{
  "title": "Example Summary",
  "items": [
    { "label": "People", "value": "42" }
  ],
  "widget": {
    "mode": "data",
    "type": "chart",
    "variant": "force-graph",
    "data": {
      "nodes": [{ "id": "skill:Solidity", "label": "Solidity", "group": "skill" }],
      "links": []
    }
  }
}
```

Notes:
- Always include `items` as a fallback for clients/surfaces that cannot render the widget.
- For third-party widgets, prefer `mode: "embed"` with explicit origins and auth constraints.

Example: third-party embedded widget summary
```json
{
  "allowedOrigins": ["https://widgets.example.com"],
  "summaryBySurface": {
    "home": {
      "source": "api",
      "title": "Module Snapshot",
      "endpoint": "/api/modules/example/summary",
      "layout": "widget",
      "widget": {
        "mode": "embed",
        "src": "https://widgets.example.com/summary?module=example",
        "height": 220
      }
    }
  }
}
```

Example with excerpt:
```json
{
  "summary": {
    "source": "api",
    "title": "Announcements",
    "endpoint": "/api/modules/announcements/summary",
    "layout": "excerpt",
    "truncate": 140,
    "maxItems": 1,
    "showTitle": true
  }
}
```

Example with progress:
```json
{
  "summary": {
    "source": "api",
    "title": "Completion",
    "endpoint": "/api/modules/profile-completion/summary",
    "progressKey": "Progress"
  }
}
```

### Surface-aware summaries
If a module needs different summaries per surface, use `summaryBySurface` with placeholders.

```json
{
  "summaryBySurface": {
    "home": {
      "source": "api",
      "title": "Cohort Skills",
      "endpoint": "/api/modules/skills-explorer/summary"
    },
    "people": {
      "source": "api",
      "title": "Cohort Skills",
      "endpoint": "/api/modules/skills-explorer/summary"
    },
    "profile": {
      "source": "api",
      "title": "Profile Skills",
      "endpoint": "/api/modules/skills-explorer/summary/profile?handle={handle}"
    }
  }
}
```

Summary requests can include `Authorization: Bearer <access_token>` if the user is signed in. Use this for summaries that require the current user (for example, `/me` summaries). Placeholders like `{handle}` are replaced by the portal when rendering profile surfaces.

## 2) (Optional) Store module data in the core DB
If your module needs server-side storage but you want to avoid migrations, use `public.module_data`.

### Choosing `module_data` vs new tables
`public.module_data` is intentionally a simple JSONB store keyed by `(module_id, user_id)`.
It optimizes for speed of iteration and “one document per user per module”.

Use `module_data` when:
- Your module stores **per-user settings or content** (one blob per user).
- You don’t need strong relational constraints (FKs, unique constraints across many rows).
- You don’t expect heavy cross-user queries (analytics, leaderboards, “who has X?”).
- The data model is still changing rapidly.

Prefer **new tables + migrations** when:
- You have a **many-to-many** relationship (e.g. users ↔ badges, users ↔ teams).
- When DB-enforced **data integrity** is required (FKs, unique constraints, cascades).
- For **queryability at scale** (indexes, filtering, ordering, joins).
- You want the data to be a reusable **platform primitive** used by multiple modules.

Concrete examples:

Good fits for `module_data` (usually *not* platform core):
- Module UI preferences (dismissed tips, layout options)
- Draft wizard state / onboarding progress
- Per-user module configuration blobs
- Single “profile enhancer” output per user (if not queried across users)

Good fits for new tables (often platform core):
- Badges/achievements (definitions + user awards)
- Entitlements/roles (authorization primitives)
- Announcement feeds
- Event/audit logs
- Payment-related records

#### Case study: badges
Badges were implemented with two tables:
- `badge_definitions`: the shared catalog
- `user_badges`: the join table of awards (enforces uniqueness with a composite primary key)

This would be awkward in `module_data` because it’s naturally many-to-many, benefits from
unique constraints, and is useful across surfaces (e.g. public profiles) and potentially
across multiple modules.

#### Designing for external consumption
If you want third parties to build tools on top of portal data:
- Prefer stable, human-facing identifiers (e.g. `handle`) in public APIs.
- Consider adding portal-owned endpoints that return “composed” views (e.g. badges by handle)
  so external apps don’t need to join raw tables.

### Generate a module key
```bash
npm run module:key
```

Insert the hash into the DB:
```sql
insert into public.module_keys (module_id, key_hash)
values ('skills-explorer', '<sha256>');
```

### Write module data
`POST /api/module-data`

Headers:
- `x-module-id`: your module id
- `x-module-key`: your module key (raw)

Body:
```json
{
  "userId": "uuid",
  "visibility": "public",
  "payload": {
    "skills": ["Solidity", "UX"],
    "graph": { "nodes": 42, "edges": 64 }
  }
}
```

### Read module data
`GET /api/module-data?module_id=skills-explorer&user_id=<uuid>`

Visibility rules:
- `public` is always returned
- `authenticated` requires `Authorization: Bearer <access_token>`
- `private` is returned only for the owner
- module key can read all rows for its module

## TypeScript + Supabase: keep generated DB types in sync

If your module adds **Supabase RPC functions** (SQL `create function ...`) and you call them via `supabase.rpc(...)`, make sure the portal’s generated DB types include the new function under `Database["public"]["Functions"]`.

Otherwise, TypeScript will infer the rpc function name parameter as `never` and you’ll get a build error like:

- `Argument of type "<function_name>" is not assignable to parameter of type never`

### What to do when you add an RPC
- Add the SQL migration (e.g. `supabase/migrations/00xx_my_rpc.sql`)
- Update the generated DB types file (currently `src/lib/types/db.ts`) so it contains:
  - `Functions.my_rpc_name.Args`
  - `Functions.my_rpc_name.Returns`

If you’re using `supabase gen types typescript`, re-run the generator and commit the updated types.
If you’re maintaining types manually, add a minimal function signature entry by hand.

Example:

```ts
Functions: {
  signup_referrals_list: {
    Args: { p_limit: number; p_offset: number; p_q?: string; p_status?: string };
    Returns: Array<{
      id: string;
      email: string;
      referral: string | null;
      created_at: string | null;
      has_account: boolean;
    }>;
  };
}
```

## Staging validation: seeds + smoke tests (recommended)
If your module adds new tables/migrations or depends on specific data states, add a staging seed so preview deployments can be tested reliably.

Guidelines:
- Put staging-only seeds under `supabase/seeds/staging/`.
- Make seeds **idempotent** (safe to run multiple times):
  - prefer deterministic UUIDs and `insert ... on conflict ... do update` (upsert)
  - avoid creating duplicates on repeated runs
- If permissions matter, define test personas (e.g. host/admin/contributor) and document which roles/entitlements are required.
- Define at least one smoke test:
  - API-level checks (fast) for key endpoints
  - optionally a Playwright flow + screenshots for a human-readable PR report

This pairs well with an automated "PR ready" pipeline that:
1) migrates staging
2) applies staging seeds
3) runs smoke tests (and optionally Playwright)
4) posts a short report back to the PR

## 3) (Optional) Sync registry to DB
If you need queryable module metadata:

```bash
npm run sync:modules
```

This upserts registry entries into `public.modules`.
