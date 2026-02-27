# module-spec: Polling

## Module ID
`polling`

## Owner / contact
`@dekanbro`

## Problem / user value
Hosts and community leaders need a lightweight way to ask quick, structured questions and collect sentiment in the portal without spinning up external forms.

Primary users:
- Hosts creating polls for cohort/DAO members
- Members voting in active polls

Core value:
- Fast pulse checks (interest, priorities, scheduling)
- Transparent aggregate results for decisions
- Keep engagement in-portal

## Scope (what's in / out)
In scope (v1):
- Create a poll with:
  - question/title
  - optional description
  - 2-6 options
  - close_at timestamp (optional)
  - visibility: `cohort` (default) or `all-members`
- List active/open polls and recently closed polls
- One vote per user per poll (change vote allowed until poll closes)
- Poll results visible after voting (or immediately if configured public)
- Host can close poll early
- Module summary for card:
  - active poll count
  - total votes in last 7 days

Out of scope (future):
- Ranked-choice / weighted voting
- Anonymous voting with cryptographic proofs
- Cross-posting to Discord/Telegram
- Poll templates library

## UX / surfaces
Surfaces:
- `people-tools` (primary shared discovery + voting feed)
- `me-tools` (secondary personal voting/results surface)

Experience:
- Main module route: `/modules/polling`
- Module renders as a page-mode experience (not widget-only)
- Sections:
  - `Open polls`
  - `Closed polls`
  - `Create poll` (host only)
- Poll card states:
  - not voted: options enabled
  - voted: highlight selected option + show percentages
  - closed: read-only + final tally

Key interactions:
- Voting is optimistic in UI but confirmed by API response
- If user changes vote, prior vote is replaced
- Host can click `Close now` to end voting

## Card layout
`default`

## Summary layout
`compact`

## Summary widget mode (if widget)
`not-applicable`

## Storage preference
`dedicated-tables`

## Data model (fields)
Use dedicated polling tables for v1 so eligibility and voting constraints are enforced at API/DB layer.

Suggested records:
- Poll definition (`public.polls`):
  - `id`
  - `question`
  - `description`
  - `options[]` (id, label)
  - `created_by`
  - `created_at`
  - `close_at`
  - `closed_at`
  - `visibility`
- Vote record (`public.poll_votes`):
  - `poll_id`
  - `user_id`
  - `option_id`
  - `created_at`
  - `updated_at`

Constraints:
- Unique (`poll_id`, `user_id`) for one active vote per user
- Reject votes when poll is closed (`closed_at` set or `close_at < now`)
- Enforce eligibility for create/vote/view_results based on role + entitlement rules
- Add Supabase migration(s) for `public.polls` + `public.poll_votes` and related indexes/constraints

## API requirements
Module endpoints:

- `GET /api/modules/polling`
  - returns open + recent closed polls with aggregate counts and viewer vote

- `GET /api/modules/polling/[id]`
  - returns poll detail, options/tallies, viewer vote, and eligibility state

- `POST /api/modules/polling`
  - host-only
  - creates poll

- `POST /api/modules/polling/[id]/vote`
  - signed-in users
  - creates or updates caller's vote

- `POST /api/modules/polling/[id]/close`
  - host-only
  - closes poll immediately

- `GET /api/modules/polling/summary`
  - compact summary for module card

Validation/auth expectations:
- Poll creation requires 2-6 unique non-empty options
- Vote option must belong to poll
- Non-host cannot close polls
- Create/vote/view_results checks enforce eligibility consistently
- Domain events are emitted for lifecycle actions: `poll_created`, `vote_cast`, `poll_closed`

## Portal RPC (optional)
Not required for v1.

## Allowed iframe origins (optional)
N/A (portal-owned module)

## Acceptance criteria
- [ ] Module is registered in `modules/registry.json`
- [ ] Signed-in members can view open/closed polls
- [ ] Host can create poll with 2-6 options
- [ ] Signed-in member can cast vote and change vote before close
- [ ] Closed polls reject new votes
- [ ] Host can close poll manually
- [ ] Eligibility rules are enforced for create/vote/view_results
- [ ] Lifecycle events emitted: `poll_created`, `vote_cast`, `poll_closed`
- [ ] Summary endpoint returns active count + recent vote count
- [ ] Lint passes

## Testing / seed data (required for DB-backed features)
- [ ] DB migration(s) added for polling tables and constraints
- [ ] Seed plan:
  - at least 2 open polls and 1 closed poll
  - votes from multiple sample users
- [ ] Personas covered:
  - host creator
  - member voter
  - non-host attempting unauthorized close
- [ ] Smoke tests:
  - create poll (host)
  - vote then change vote (member)
  - close poll then verify vote rejected

## Automation consent
- [x] OK to auto-generate a PR for this spec
