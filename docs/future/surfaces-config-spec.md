# Surfaces Config (Proposed)

Status: Draft
Owner: TBD
Last updated: 2026-02-23

## Why
Today, top-level surfaces (home, people, modules, me) are assembled by route-level code
and hardcoded nav links. That is fine for current velocity, but adding new role-specific
or entitlement-specific surfaces (for example `/host`, `/member`) currently requires
manual updates in multiple places.

This proposal introduces a top-level registry config for surfaces so navigation and
surface composition can be driven by metadata instead of spread across page code.

## Current model (v0)
- Nav links are hardcoded in `src/components/Nav.tsx`.
- Surface pages filter modules by tags in page code:
  - home: `start-here`
  - people: `people-tools`
  - profile: `profile-tools-public`
  - me: `me-tools`
- Access is enforced in module rendering via roles + entitlements.

This remains the recommended implementation for now.

## Goals
- Define top-level surfaces in one place (label, path, visibility rules).
- Define default module selection per surface in the registry.
- Preserve module-level access checks as the final guard.
- Keep backward compatibility with existing tag-based surfaces.

## Non-goals (v1 of this proposal)
- Removing module-level `access` checks.
- Dynamic route generation without code files.
- Replacing module summaries/capabilities contracts.

## Proposed registry shape
Add a top-level `surfaces` array to `modules/registry.json`:

```json
{
  "surfaces": [
    {
      "id": "home",
      "label": "Home",
      "path": "/",
      "showInNav": true,
      "moduleSelector": { "tagsAny": ["start-here"] }
    },
    {
      "id": "people",
      "label": "People",
      "path": "/people",
      "showInNav": true,
      "moduleSelector": { "tagsAny": ["people-tools"] }
    },
    {
      "id": "host",
      "label": "Host",
      "path": "/host",
      "showInNav": true,
      "requiresRoleAny": ["host"],
      "moduleSelector": { "tagsAny": ["host-tools"] }
    },
    {
      "id": "member",
      "label": "Member",
      "path": "/member",
      "showInNav": true,
      "requiresEntitlementAny": ["dao-member", "cohort-access"],
      "moduleSelector": { "tagsAny": ["member-tools"] }
    }
  ]
}
```

## Module-level support (optional extension)
Modules may optionally declare explicit surface targeting in addition to tags:

```json
{
  "id": "guild-ops",
  "surfaces": ["host"],
  "tags": ["host-tools"],
  "access": { "requiresAuth": true }
}
```

Selection precedence (proposed):
1. If surface has `moduleSelector`, use it.
2. Else, use module `surfaces` includes `<surface-id>`.
3. Else, fallback to legacy tag rules for that route.

## Authorization model
- Surface-level guards (role/entitlement) control nav visibility and route UX.
- Module-level guards (`requiresAuth`, `access.entitlement`, host checks) remain required.
- APIs still enforce server-side auth/authorization.

Do not treat surface visibility as security boundaries.

## Rollout plan
1. Keep current hardcoded pages and nav as-is.
2. Add `surfaces` metadata to registry (non-breaking).
3. Add helper utilities to read `surfaces` config.
4. Migrate nav rendering to use registry surfaces (with fallback to hardcoded links).
5. Migrate `/host` and `/member` pages to use selector config.
6. Deprecate implicit hardcoded surface filters once parity is confirmed.

## Open questions
- Should a surface support both `tagsAny` and `moduleIds` for precise curation?
- Should `showInNav` default to `false` when guards are present?
- Do we want per-surface presentation overrides (grid columns, default sort)?
- Should routes without `showInNav` still be discoverable via `/modules`?

## Notes
This proposal is intentionally future-facing. The current hardcoded pattern remains the
active implementation path until we decide to migrate.
