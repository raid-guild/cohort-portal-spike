# Staging DB & automation flows

This repo uses a **separate Supabase staging project** to safely validate schema changes and new modules before merging.

## Environments

### Production
- Uses the production Supabase project.
- Vercel **Production** environment variables should point to production.
- Database connection string is typically stored as `DATABASE_URL`.

### Staging (Preview)
- Uses a separate Supabase staging project (free-tier is fine for PoC).
- Vercel **Preview** environment variables should point to staging.
- Staging database connection string is stored as `STAGING_DATABASE_URL` for automation, and `DATABASE_URL` (Preview scope) for the deployed preview.

Recommended Vercel env var mapping:
- **Preview:**
  - `DATABASE_URL` → staging Postgres
  - `NEXT_PUBLIC_SUPABASE_URL` → staging
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → staging
  - `SUPABASE_SERVICE_ROLE_KEY` (server-side only) → staging
- **Production:**
  - same variable names, but production values

## Migrations

Migrations live under `supabase/migrations/` and are applied in filename order.

### Apply migrations to staging

Automation can run migrations against staging using:

```bash
node scripts/staging_migrate_all.js
```

Notes:
- The migration runner maintains a ledger table: `public._openclaw_migrations`.
- It applies each file in its own transaction.
- It requires `STAGING_DATABASE_URL` and refuses to run if it matches `DATABASE_URL`.
- For Supabase, it is often easiest to use the **Connection Pooler** host for staging (it can be more network-friendly than `db.<ref>.supabase.co`).

### Production migrations

Do **not** run production migrations from ad-hoc scripts or assistant runtimes.
Preferred approach:
- CI/CD workflow with explicit approval step, or
- manual release checklist with a single responsible operator.

## Staging seeds

Staging-only, idempotent seed SQL files live under:

- `supabase/seeds/staging/`

Guidelines:
- Make seeds idempotent (deterministic IDs + upserts).
- Do not run staging seeds against production.

## PR automation ("ready" flow)

We use automation to reduce PR review loop time and avoid noisy notifications.

High-level behavior:
1) Monitor open PRs + repo events (reviews/comments/checks/deployments).
2) When CodeRabbit feedback is present:
   - automatically fix unresolved review threads via codegen
   - push commits to the PR branch until threads are resolved
3) Notify Discord only when:
   - urgent failures (checks/deployments), or
   - PR is "ready" (CodeRabbit resolved *and* PR head is updated after the bot’s last activity)

Next planned step:
- When a PR becomes "ready", run a staging validation pipeline:
  1) migrate staging
  2) apply staging seeds
  3) run smoke tests (and optionally Playwright + screenshots)
  4) post a short report back to the PR

## Safety & locking

Because staging is shared, migrations should be serialized (one at a time) to avoid competing schema changes.
A simple lock (file or DB advisory lock) is recommended for any automated staging pipeline.
