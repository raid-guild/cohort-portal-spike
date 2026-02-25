# module-spec: Cohort DM Guide

## Module ID
`cohort-dm-guide`

## Owner / contact
`@dekanbro` (update if different)

## Problem / user value
Hosts need a single place in the portal to open the Cohort DM facilitation docs without context-switching across tools. This module provides fast in-portal access to the already deployed Nextra documentation site.

Primary users:
- Hosts running cohort operations
- Backup facilitators who need the same playbook and references

Core value:
- Reduce friction for host workflows by surfacing the DM guide on the host surface
- Reuse existing docs deployment instead of rebuilding content in the portal
- Keep module implementation low-maintenance (registry-driven external link)

## Scope (what's in / out)
In scope:
- Add a new host-only module entry in `modules/registry.json`
- Open docs site in a dialog iframe from a module card action
- Host-only visibility in portal via tags/roles
- Optional static summary text on the module card

Out of scope (future):
- Mirroring docs content into portal-owned routes
- Write/edit docs from inside the portal
- Cross-system SSO/auth bridging from portal session to docs site
- Analytics/dashboard features for docs usage

## UX / surfaces
Surfaces:
- `host-tools` only
- Hidden from non-host users via `hosts` tag and host role checks

Experience:
- Module card appears on `/host`
- CTA opens `https://cohort-dm-guide.vercel.app` in dialog iframe
- Dialog uses larger height for docs readability (target ~820px)
- Keep docs nav and search available unless `embed=1` mode is implemented in docs app

Key UI states:
- Host sees module card and can open docs
- Non-host does not see this module in host lists
- If docs origin blocks iframe embedding, user receives browser frame refusal (implementation dependency below)

## Storage preference
`unknown`

## Data model (fields)
No module-specific persisted data required for v1.

Registry metadata required:
- `id`: `cohort-dm-guide`
- `lane`: `hosts`
- `type`: `link`
- `url`: `https://cohort-dm-guide.vercel.app`
- `requiresAuth`: `true`
- `tags`: `["hosts", "host-tools"]`
- `presentation.mode`: `dialog`
- `presentation.iframe.height`: `820` (or similar)

## API requirements
No new module API endpoints required for v1.

Optional:
- Static summary block in registry (no API) for card context, e.g.:
  - "Facilitation checklists"
  - "Session templates"
  - "Escalation playbooks"

Auth expectations:
- Portal controls visibility by role/tags
- External docs app remains publicly reachable unless separately secured

## Portal RPC (optional)
Not required for v1.

If needed later:
- Add `allowedOrigins` and RPC actions after docs app explicitly implements postMessage requests.

## Allowed iframe origins (optional)
`https://cohort-dm-guide.vercel.app`

Note:
- This should be configured only if/when Portal RPC is enabled for this module.
- Independent of RPC, docs app must allow embedding by portal origin (CSP `frame-ancestors` / no conflicting `X-Frame-Options`).

## Acceptance criteria
- [ ] Module is registered in `modules/registry.json`
- [ ] Module appears on `/host` via `host-tools` tag
- [ ] Module is hidden from non-host users (`hosts` tag + role gate)
- [ ] Clicking CTA opens docs site in dialog iframe
- [ ] Iframe renders successfully in deployed environments (no frame-blocking headers)
- [ ] Optional: module card includes static summary copy
- [ ] Lint passes

## Testing / seed data (required for DB-backed features)
- [x] No DB schema changes required
- [x] No seed data required
- [ ] Smoke checks:
  - host account can see and open module on `/host`
  - non-host account cannot access host surface/module card
  - iframe load succeeds against production docs URL

## Automation consent
- [x] OK to auto-generate a PR for this spec
