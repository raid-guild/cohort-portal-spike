# module-spec: Feedback Center

## Module ID
`feedback-center`

## Owner / contact
`@dekanbro`

## Problem / user value
Users need a simple in-portal way to submit app feedback, report bugs, and request features without leaving the product or guessing where to post.

Primary users:
- Any signed-in user submitting feedback/bugs/features
- Hosts/admins triaging and tracking status

Core value:
- Single intake flow for product signals
- Structured bug reports (repro steps, expected vs actual)
- Transparent status so users know what happened to their submissions

## Scope (what’s in / out)
In scope (v1):
- Unified intake form with type selector: `bug`, `feature`, `feedback`, `module_request`
- Type-specific fields and validation
- Reporter can view own submissions + statuses
- Host/admin triage view to update status/priority/notes
- Module summary metrics for card (new, triaged, in progress)
- Markdown editor for long-form description fields

Out of scope (future):
- Public voting/roadmap board
- Automated duplicate detection
- Rich attachment uploads/screenshots
- GitHub issue sync automation
- SLA/escalation automation

## UX / surfaces
Surfaces:
- `me-tools` (primary submit + personal tracking)
- optional `host-tools` view state for triage actions (same module, role-based sections)

Experience:
- Route: `/modules/feedback-center`
- Tabs or segmented controls:
  - `Submit`
  - `My reports`
  - `Triage` (host/admin only)

Submit flow:
- Type chooser (`bug`, `feature`, `feedback`, `module_request`)
- Required fields:
  - all: title, description (markdown)
  - bug: steps to reproduce, expected, actual
  - feature: user problem, proposed outcome (core portal feature or enhancement to an existing module)
  - module_request: user problem, proposed outcome, target module concept (proposed module name/slug and short summary)
- Auto-captured context: current route, module id (if available), browser user agent
- Success state returns a tracking ID

Key UI states:
- Empty state for no personal submissions
- Validation errors per field
- Host triage table with filters by type/status/priority
- Permission denied when non-host opens triage controls

Card sizing intent:
- `presentation.layout = default`
- Summary card shows counts by status (new, triaged, in_progress)

## Card layout
`default`

## Summary layout
`compact`

## Summary widget mode (if widget)
`not-applicable`

## Storage preference
`new tables + migrations`

## Data model (fields)
Proposed tables:

1) `public.feedback_items`
- `id uuid pk default gen_random_uuid()`
- `type text not null` check in (`bug`, `feature`, `feedback`, `module_request`)
- `title text not null`
- `description_md text not null`
- `steps_to_reproduce_md text null` (required when `type='bug'`)
- `expected_result_md text null` (required when `type='bug'`)
- `actual_result_md text null` (required when `type='bug'`)
- `problem_md text null` (required when `type='feature' or type='module_request'`)
- `proposed_outcome_md text null` (required when `type='feature' or type='module_request'`)
- `status text not null default 'new'` check in (`new`, `triaged`, `in_progress`, `done`, `closed`)
- `priority text not null default 'medium'` check in (`low`, `medium`, `high`)
- `module_id text null`
- `route_path text null`
- `reporter_user_id uuid not null`
- `assignee_user_id uuid null`
- `triage_notes text null`
- `browser_meta jsonb null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `closed_at timestamptz null`

Indexes:
- index on `reporter_user_id, created_at desc`
- index on `status, priority, created_at desc`
- index on `type, created_at desc`

Access model:
- Any signed-in user can create feedback items
- Reporter can read own items
- Host/admin can read all items + update triage/status fields
- Enforce in API and RLS

## API requirements
Module endpoints (portal-owned):

- `GET /api/modules/feedback-center/items`
  - Auth required
  - Query: `mine=true|false`, `type`, `status`, `priority`, `q`, `limit`, `cursor`
  - Non-host users are forced to `mine=true`

- `POST /api/modules/feedback-center/items`
  - Auth required
  - Creates new feedback item with type-specific validation

- `PATCH /api/modules/feedback-center/items/[id]`
  - Auth required
  - Reporter can edit own item only while status=`new`
  - Host/admin can update status/priority/assignee/triage_notes

- `GET /api/modules/feedback-center/summary`
  - Auth required
  - Returns compact counts for card summary

Validation/auth expectations:
- All endpoints require signed-in user
- Type-specific required fields enforced server-side
- Role checks: host/admin for triage updates and non-mine listing

## Portal RPC (optional)
Not required for v1.

## Allowed iframe origins (optional)
N/A for v1 (portal-owned module route)

## Acceptance criteria
- [ ] Module is registered in `modules/registry.json`
- [ ] Module appears on `me-tools`
- [ ] Signed-in user can submit bug/feature/feedback/module_request items
- [ ] Type-specific required fields are enforced
- [ ] Reporter can view own submissions and statuses
- [ ] Host/admin can view all submissions and triage/update statuses
- [ ] Non-host users cannot access global triage actions
- [ ] Summary endpoint renders module card metrics
- [ ] Lint passes

## Testing / seed data (required for DB-backed features)
- [ ] Seed plan: deterministic sample rows for each type + status
- [ ] Staging seed added (idempotent; safe to run repeatedly)
  - Location: `supabase/seeds/staging/`
  - Uses deterministic IDs and/or upserts
- [ ] Personas covered:
  - signed-in reporter
  - host/admin triager
  - signed-in non-host attempting unauthorized triage
- [ ] Smoke tests defined:
  - API checks:
    - reporter create/read own item succeeds
    - reporter cannot read all items
    - host can filter all items and update status
    - type-specific validation rejects invalid payloads

## Automation consent
- [x] OK to auto-generate a PR for this spec
