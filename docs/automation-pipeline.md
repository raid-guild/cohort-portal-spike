# Automation pipeline (OpenClaw + GitHub + Vercel + Supabase)

This repo uses a lightweight pipeline that blends **human gates** (labels + merge) with **automation** (codegen, staging resets, migrations, smoke checks).

The goal is:
- PR authors ship quickly.
- Reviewers have a deterministic staging environment.
- Production deploys remain human-controlled, with automated migrations.

---

## Environments

### Vercel
- **Production**: `main` branch (Vercel production branch)
- **Staging**: `staging` branch (stable URL)
  - Example: `https://cohort-portal-spike-git-staging-dekanbros-projects.vercel.app`

### Supabase
- **Staging DB**: pointed to by `STAGING_DATABASE_URL`
- **Production DB**: pointed to by `PROD_DATABASE_URL` (GitHub secret)

---

## Labels (human + bot)

### Staging labels
- `ready-to-stage` (human): tells automation to stage this PR.
- `staged` (bot): staging succeeded; comment includes URL + checklist.
- `staging-failed` (bot): staging failed; comment includes error and likely cause.
- `verified-on-staging` (human): reviewer completed the staging checklist.

---

## Automation pieces

### 1) Module-spec issue monitor → codegen PR

**Trigger:** A GitHub issue labeled `module-spec` with the “auto-generate PR” checkbox checked.

**Runner:** OpenClaw cron job:
- `GitHub module-spec issue monitor (repo events)` (every 15 min)

**How it works:**
1. Monitor script polls repo events and emits actionable module-spec issues:
   - `/data/workspace/scripts/github_issue_module_spec_monitor.js`
2. For each actionable issue, OpenClaw spawns the `codegen` agent to implement a minimal end-to-end module skeleton and open a PR.

**PR requirements (enforced by cron instructions):**
- PR body must include `Fixes #<issueNumber>`.
- PR body must include a required, non-empty section:

```md
## Manual test plan (staging)

### Areas touched
- ...

### Test accounts / roles
- ...

### Steps
- [ ] ...

### Expected results
- ...
```

If the issue doesn’t include enough information to write a real test plan, codegen should **ask questions on the issue** and **not open a PR**.

---

### 2) PR review monitor → CodeRabbit fix loops

**Trigger:** PRs with actionable CodeRabbit feedback.

**Runner:** OpenClaw cron job:
- `GitHub PR review monitor (repo events)`

**How it works:**
- Runs `/data/workspace/scripts/github_pr_review_monitor.js`.
- If a PR needs fixes and no existing codegen-fix session is active, it spawns a `codegen` agent to resolve remaining CodeRabbit threads and push commits to the PR branch.

---

### 3) Staging poller (ready-to-stage → staged)

**Trigger:** Open PR labeled `ready-to-stage`.

**Runner:** OpenClaw cron job:
- `Stage poller (ready-to-stage → staged)` (every 30 min)

**Script:**
- `automation/stage-poller.mjs`

**What it does (one PR at a time):**
1. Acquire a lock (`.stage.lock`) to prevent concurrent staging runs.
2. Pick newest updated PR with label `ready-to-stage`.
3. Reset staging DB (nuke & pave public schema).
4. Check out the PR head SHA in a detached git worktree.
5. Apply migrations + seeds from that PR snapshot:
   - `supabase/migrations/*.sql`
   - `supabase/seed.sql`
   - `supabase/seeds/staging/*.sql` (fixtures, idempotent)
6. Promote by updating `staging` branch to PR head SHA.
7. Wait for `${STAGING_BASE_URL}/api/health` to serve the expected commit SHA.
8. Run minimal smoke checks.
9. Update PR labels + comment the staging URL + checklist.

**Important conventions:**
- Staging fixtures must be **idempotent** and live in `supabase/seeds/staging/`.
- Do not put staging-only fixtures in `supabase/seed.sql`.

---

### 4) Production: human merge to main + automated migrations

**Trigger:** merge/push to `main`.

**Automation:** GitHub Action
- `.github/workflows/prod-migrate.yml`

**Script:**
- `automation/migrate-db.mjs`

**What it does:**
- Connects to production DB (GitHub secret `PROD_DATABASE_URL`).
- Applies `supabase/migrations/*.sql` in order.
- Tracks applied migrations in `public._migrations` with checksums.
- Uses an advisory lock to avoid concurrent migration runs.

**Recommended Vercel setting:**
- Enable Vercel’s “Wait for Checks” and make `prod-migrate` a required check on `main`.
  This ensures production deploy waits for migrations to complete.

---

## Suggested end-to-end flow

1) Module spec issue opened → automation creates PR
2) Humans review PR (and/or CodeRabbit fix loop)
3) Human applies `ready-to-stage`
4) Automation stages, comments checklist, sets `staged`
5) Human tests staging, applies `verified-on-staging`
6) Human merges PR to `main`
7) GitHub Action runs production migrations
8) Vercel deploys production and health checks pass
