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
- Set `presentation.action` to `none` if you want a summary-only card.
- Tag a module with `hosts` to make it host-only (hidden for non-hosts).
- Host-only tags only control portal visibility. External modules must enforce their own access.
- Use `presentation.layout: "wide"` to make a module card span full width in surface grids.
- Use `presentation.height: "double"` to give a module card extra vertical space.

## Module isolation
Modules are treated as isolated surfaces. When a module opens in a dialog, it loads in
an iframe (even for portal-owned modules) to keep behavior consistent with third-party
modules and to avoid leaking state across surfaces.

If a module needs portal context (for example, the auth token or a profile refresh),
use portal-owned APIs and messaging between the iframe and parent window.

## Capabilities (contract metadata)
Use `capabilities` to document what a module is allowed to do. This is a registry-side
contract for now (not enforced automatically), but it keeps portal-owned and third-party
modules aligned on expectations.

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
- `layout`: `list` (default), `excerpt`, or `compact`
- `maxItems`: limit the number of items shown
- `truncate`: max character length for values or excerpts
- `showTitle`: boolean to show/hide the summary title
- `progressKey`: render a progress bar for the matching item label
- `imageKey`: render a circular thumbnail for the matching item label (compact layout)

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
- You need **data integrity** enforced by the DB (FKs, unique constraints, cascades).
- You need **queryability at scale** (indexes, filtering, ordering, joins).
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

## 3) (Optional) Sync registry to DB
If you need queryable module metadata:

```bash
npm run sync:modules
```

This upserts registry entries into `public.modules`.
