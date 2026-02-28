# module-spec: Polling

## Module ID
`polling`

## Owner / contact
`@dekanbro` (update if different)

## Problem / user value
RaidGuild needs a reusable way to run structured votes (for example: Raider of the Month, cohort preferences, DAO-internal sentiment checks) without creating one-off modules each time.

Primary users:
- Poll creators (initially authenticated users; optionally narrowed by role/entitlement)
- Eligible voters (defined per poll by role/entitlement rules)
- Hosts monitoring participation and outcomes

Core value:
- One generic polling engine that supports many community workflows
- Enforced eligibility at API/DB layer (not only UI)
- Event-driven hooks so notifications and future automations stay decoupled

## Scope (what's in / out)
In scope (v1):
- Create poll with:
  - title, description
  - open/close window (`opens_at`, `closes_at`)
  - single-choice voting (one option per voter)
  - optional vote change before close (`allow_vote_change`)
  - result visibility mode (`live` or `after_close`)
- Poll options:
  - free-text labels
  - optional nominee user reference (`subject_user_id`) for use cases like Raider of the Month
- Eligibility rules per poll for:
  - who can create polls
  - who can vote
  - who can view results
  - rule types: `authenticated`, `role`, `entitlement`
- Poll list + poll detail + cast vote + close poll
- Summary endpoint for module card
- Domain events emitted for create/vote/close

Out of scope (later):
- Ranked-choice or weighted voting
- Anonymous ballots
- Public unauthenticated voting
- Nominations as a separate workflow phase
- Multi-select votes
- Rich media options

## UX / surfaces
Surfaces:
- `people-tools` (community-discoverable voting module)
- `me-tools` (personal access to polls and vote history)
- optional `member-tools` summary variant later for member-only governance snapshots

Presentation:
- `presentation.mode = "page"`
- `presentation.layout = "default"`

Key UI states:
- poll list: upcoming/open/closed tabs
- poll detail: not-open-yet, open-and-eligible, open-but-ineligible, closed
- vote submit success/error
- results:
  - live if `results_visibility=live`
  - hidden until close if `results_visibility=after_close`

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

1) `public.polls`
- `id uuid pk default gen_random_uuid()`
- `title text not null`
- `description text null`
- `created_by uuid not null`
- `opens_at timestamptz not null`
- `closes_at timestamptz not null`
- `status text not null default 'open'` check in (`draft`, `open`, `closed`)
- `allow_vote_change boolean not null default false`
- `results_visibility text not null default 'live'` check in (`live`, `after_close`)
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

2) `public.poll_options`
- `id uuid pk default gen_random_uuid()`
- `poll_id uuid not null references public.polls(id) on delete cascade`
- `label text not null`
- `subject_user_id uuid null` (optional nominee reference)
- `sort_order int not null default 0`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

3) `public.poll_votes`
- `id uuid pk default gen_random_uuid()`
- `poll_id uuid not null references public.polls(id) on delete cascade`
- `option_id uuid not null references public.poll_options(id) on delete cascade`
- `voter_user_id uuid not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- unique constraint: `(poll_id, voter_user_id)` (single-choice v1)

4) `public.poll_eligibility_rules`
- `id uuid pk default gen_random_uuid()`
- `poll_id uuid not null references public.polls(id) on delete cascade`
- `action text not null` check in (`create`, `vote`, `view_results`)
- `rule_type text not null` check in (`authenticated`, `role`, `entitlement`)
- `rule_value text null` (for role/entitlement names)
- `created_at timestamptz not null default now()`

Indexes:
- `polls(status, opens_at, closes_at)`
- `poll_votes(poll_id, option_id)`
- `poll_eligibility_rules(poll_id, action)`

RLS/authz intent:
- All writes require authenticated users
- Poll create allowed only when `create` rules pass
- Vote allowed only when:
  - poll is open and within window
  - `vote` rules pass
  - voter has not voted yet (or vote change enabled)
- Result visibility controlled by `view_results` rules plus `results_visibility`

## API requirements
Module endpoints (portal-owned):

- `GET /api/modules/polling`
  - List visible polls with state metadata and counts
  - Query: `status`, `cursor`, `limit`

- `POST /api/modules/polling`
  - Auth required
  - Creates poll + options + eligibility rules
  - Enforces `create` permissions

- `GET /api/modules/polling/[id]`
  - Returns poll detail, options, user vote status, and result visibility

- `POST /api/modules/polling/[id]/vote`
  - Auth required
  - Casts or updates vote (if allowed)
  - Enforces poll window + voter eligibility

- `POST /api/modules/polling/[id]/close`
  - Auth required
  - Allowed for poll creator and host role
  - Sets status closed early

- `GET /api/modules/polling/summary`
  - Returns compact card stats (open polls, closing soon, polls participated)

## Portal RPC (optional)
Not required for v1.

## Allowed iframe origins (optional)
N/A for v1 (portal-owned module).

## Event bus + notifications
Use persisted domain events (`portal_events`) for decoupled automation:

- `core.polling.poll_created`
- `core.polling.vote_cast`
- `core.polling.poll_closed`

Registry capability should declare emit kinds under:
- `capabilities.events.emit.kinds`

Notification integration (v1.1 target):
- Polling events are consumed by digest builders so users receive daily/weekly summaries based on existing notification preferences.
- Example digest items:
  - new poll available to you
  - poll closing soon
  - poll results published

This keeps realtime vote writes independent from email delivery and reuses the existing outbox + notification cadence model.

## Acceptance criteria
- [ ] Module is registered in `modules/registry.json`
- [ ] Module page renders for signed-in users
- [ ] New migration creates poll tables, constraints, and indexes
- [ ] API enforces create/vote/result eligibility rules (`authenticated`, `role`, `entitlement`)
- [ ] User can cast one vote per poll in v1
- [ ] Vote change only works when `allow_vote_change=true` and poll still open
- [ ] Closed polls reject new votes
- [ ] Summary endpoint renders on module card
- [ ] Poll lifecycle events are emitted (`poll_created`, `vote_cast`, `poll_closed`)
- [ ] Lint passes

## Testing / seed data (required for DB-backed features)
- [ ] Seed plan: minimum open + closed polls with deterministic options
- [ ] Staging seed added (idempotent; safe to run repeatedly)
  - Location: `supabase/seeds/staging/`
  - Uses deterministic IDs and/or upserts
- [ ] Personas covered:
  - signed-in user (no special entitlement)
  - `dao-member` entitlement user
  - `host` role user
- [ ] Smoke tests defined:
  - API checks:
    - eligible voter can vote
    - ineligible voter is denied
    - duplicate second vote denied unless vote-change is enabled
    - closed poll denies vote
    - host can close poll
  - Optional UI flow:
    - create poll, vote, verify summary counts update

## Automation consent
- [x] OK to auto-generate a PR for this spec
