# Relationship CRM

Relationship CRM is a portal-owned module for hosts and active DAO members to track account
pipelines, interactions, and follow-up tasks in one place.

## Key files
- `src/modules/relationship-crm/RelationshipCrm.tsx` — client UI for list/detail and quick-add flows.
- `src/app/api/modules/relationship-crm/*` — module API routes and access validation.
- `supabase/migrations/0029_relationship_crm.sql` — schema, indexes, and RLS policies.
- `supabase/seeds/staging/0008_relationship_crm_fixtures.sql` — deterministic staging fixtures.
