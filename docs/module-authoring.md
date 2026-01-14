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
- Use tags like `start-here`, `people-tools`, `profile-tools-public`, `profile-tools-private` to surface modules.
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
