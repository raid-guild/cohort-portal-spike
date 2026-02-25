# module-spec: Relationship CRM

## Module ID
`relationship-crm`

## Owner / contact
`@dekanbro` (update if different)

## Problem / user value
Hosts and DAO contributors need a simple in-portal CRM to track relationship pipelines with sponsors, partners, and potential agency clients. Current tracking is fragmented across DMs, spreadsheets, and memory.

Primary users:
- Hosts managing sponsor/client relationships end-to-end
- DAO members supporting outreach, follow-up, and delivery conversations

Core value:
- One shared source of truth for relationship status and history
- Clear next actions and ownership to reduce dropped follow-ups
- Flexible record types so this is not limited to cohort sponsors

## Scope (what's in / out)
In scope (v1):
- Account-level CRM records (company/org or client)
- Contacts per account
- Relationship stage/status tracking
- Interaction log (note/call/email/meeting) with timestamps
- Basic follow-up tasks with due dates and assignee
- Filters by stage, owner, relationship type, and status
- Host + DAO-member access only

Out of scope (future):
- Email/calendar sync
- Revenue forecasting and weighted pipeline analytics
- Complex permission groups beyond host/dao-member
- File attachments and document generation
- External CRM sync (HubSpot/Salesforce/etc.)

## UX / surfaces
Surfaces:
- `host-tools` and `member-tools`
- Hidden from users who are neither host nor active `dao-member`

Experience:
- Module route `/modules/relationship-crm`
- Main list defaults to `active` accounts sorted by `next_follow_up_at`
- Side panel or detail view shows account profile, contacts, interactions, and open tasks
- Quick-add actions for `Add interaction`, `Create task`, `Advance stage`

Key UI states:
- Empty state with CTA to create first account
- Filtered list state with chips (stage/type/owner)
- Overdue follow-up indicator
- Permission denied state for non-authorized users

Card sizing intent:
- `presentation.layout = wide` (CRM tables benefit from width)
- Summary card shows active accounts, overdue tasks, and due-today follow-ups

## Card layout
`wide`

## Summary layout
`compact`

## Summary widget mode (if widget)
`not-applicable`

## Storage preference
`new tables + migrations`

## Data model (fields)
Proposed tables:

1) `public.relationship_crm_accounts`
- `id uuid pk default gen_random_uuid()`
- `name text not null`
- `relationship_type text not null` check in (`sponsor`, `agency-client`, `partner`, `other`)
- `stage text not null` check in (`lead`, `qualified`, `proposal`, `negotiation`, `active`, `paused`, `closed-won`, `closed-lost`)
- `status text not null default 'active'` check in (`active`, `inactive`)
- `owner_user_id uuid not null`
- `next_follow_up_at timestamptz null`
- `notes text null`
- `created_by uuid not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `deleted_at timestamptz null`

2) `public.relationship_crm_contacts`
- `id uuid pk default gen_random_uuid()`
- `account_id uuid not null references public.relationship_crm_accounts(id) on delete cascade`
- `full_name text not null`
- `role_title text null`
- `email text null`
- `phone text null`
- `preferred_channel text null` check in (`email`, `discord`, `telegram`, `phone`, `other`)
- `is_primary boolean not null default false`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

3) `public.relationship_crm_interactions`
- `id uuid pk default gen_random_uuid()`
- `account_id uuid not null references public.relationship_crm_accounts(id) on delete cascade`
- `contact_id uuid null references public.relationship_crm_contacts(id) on delete set null`
- `interaction_type text not null` check in (`note`, `email`, `call`, `meeting`, `other`)
- `summary text not null`
- `interaction_at timestamptz not null`
- `created_by uuid not null`
- `created_at timestamptz not null default now()`

4) `public.relationship_crm_tasks`
- `id uuid pk default gen_random_uuid()`
- `account_id uuid not null references public.relationship_crm_accounts(id) on delete cascade`
- `assignee_user_id uuid not null`
- `title text not null`
- `due_at timestamptz null`
- `status text not null default 'open'` check in (`open`, `done`, `canceled`)
- `created_by uuid not null`
- `completed_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Access model:
- Read/write allowed only for users with `host` role OR active `dao-member` entitlement
- Enforce in API and RLS (UI gating alone is insufficient)

## API requirements
Module endpoints (portal-owned):

- `GET /api/modules/relationship-crm/accounts`
  - Query: `stage`, `relationshipType`, `owner`, `status`, `q`, `limit`
  - Returns visible account list

- `POST /api/modules/relationship-crm/accounts`
  - Auth required; `host` OR `dao-member`
  - Creates account

- `PATCH /api/modules/relationship-crm/accounts/[id]`
  - Auth required; `host` OR `dao-member`
  - Update stage/status/owner/follow-up/notes

- `GET /api/modules/relationship-crm/accounts/[id]`
  - Returns account detail + contacts + recent interactions + open tasks

- `POST /api/modules/relationship-crm/accounts/[id]/contacts`
- `POST /api/modules/relationship-crm/accounts/[id]/interactions`
- `POST /api/modules/relationship-crm/accounts/[id]/tasks`
- `PATCH /api/modules/relationship-crm/tasks/[id]`
  - Mark done/canceled or edit due date/assignee

- `GET /api/modules/relationship-crm/summary`
  - Summary metrics for module card (active accounts, overdue tasks, due today)

Auth expectations:
- All endpoints require signed-in user
- Authorization requires `host` role or active `dao-member` entitlement
- Soft-delete or archival behavior should hide inactive/deleted records from default list responses

## Portal RPC (optional)
Not required for v1.

## Allowed iframe origins (optional)
N/A for v1 (portal-owned module route)

## Acceptance criteria
- [ ] Module is registered in `modules/registry.json`
- [ ] Module route and client UI exist for `relationship-crm`
- [ ] Module appears on `host-tools` and `member-tools`
- [ ] New migration creates CRM tables and indexes
- [ ] RLS/API enforce access: `host` role OR active `dao-member` entitlement
- [ ] Authorized user can create and update accounts
- [ ] Authorized user can add contacts/interactions/tasks
- [ ] Task status transitions work (`open` -> `done`/`canceled`)
- [ ] Filters work for stage/type/owner/status
- [ ] Summary endpoint renders module card metrics
- [ ] Lint passes

## Testing / seed data (required for DB-backed features)
- [ ] Seed plan: deterministic accounts/contacts/interactions/tasks across sponsor + agency-client examples
- [ ] Staging seed added (idempotent; safe to run repeatedly)
  - Location: `supabase/seeds/staging/`
  - Uses deterministic IDs and/or upserts
- [ ] Personas covered:
  - host user
  - dao-member user
  - signed-in user with neither host nor dao-member (denied)
- [ ] Smoke tests defined:
  - API checks:
    - host can CRUD account records
    - dao-member can CRUD account records
    - unauthorized signed-in user gets 403
    - summary endpoint returns expected shape
  - Optional Playwright flow:
    - create account, add interaction, create due task, mark done

## Automation consent
- [x] OK to auto-generate a PR for this spec
