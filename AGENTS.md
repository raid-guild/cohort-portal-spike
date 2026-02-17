# AGENTS Guide

This file orients future contributors and agents working in this repo.

## Project Summary
RaidGuild Portal is a Next.js (App Router) community portal. Profiles are core, and
everything else ships as modules defined in `modules/registry.json`. The portal uses
Supabase for auth/data/storage and integrates Stripe (billing) and Venice AI (profile
generators).

## Core Concepts
- Registry-driven modules: `modules/registry.json` is the source of truth.
- Surfaces by tags: `start-here`, `people-tools`, `profile-tools-public`, `me-tools`.
- Access control: roles (`public.user_roles`) and entitlements (`public.entitlements`).
- Module data: `public.module_data` with module keys stored in `public.module_keys`.

## Where Things Live
- App Router pages: `src/app`
- API routes: `src/app/api`
- Shared UI: `src/components`
- Portal-owned modules: `src/modules`
- Registry: `modules/registry.json`
- Supabase migrations: `supabase/migrations`
- Docs: `docs/`

## Key Docs
- Product kickoff: `docs/kickoff-spec.md`
- Architecture: `docs/architecture.md`
- Module authoring: `docs/module-authoring.md`
- Roles vs entitlements: `docs/roles-vs-entitlements.md`

## Environment Variables
Supabase:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Stripe:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID`
- `STRIPE_PORTAL_CONFIG_ID` (optional)

Venice AI:
- `VENICE_API_KEY`
- `VENICE_MODEL`
- `VENICE_IMAGE_MODEL`
- `VENICE_API_BASE_URL` (optional)

External intake:
- `FORM_INGEST_API_KEY`

## Common Commands
```bash
npm install
npm run dev
npm run lint
npm run sync:modules
npm run module:key
```

## PR Workflow (for humans + codegen agents)
- Create a feature branch from `main`.
- Keep PRs focused; if you’re changing docs *and* adding automation, consider separate PRs.
- Prefer small commits with clear messages.
- If you touch Supabase schema:
  - add a new migration in `supabase/migrations/`
  - update any dependent code and (if applicable) regenerate types (`supabase/README.md`).

### Codegen agent checklist
When implementing a new module:
1) Add/update `modules/registry.json`.
2) Add the route `src/app/modules/<module-id>/page.tsx` (server) and a client component under `src/modules/<module-id>/`.
3) Add `src/modules/<module-id>/README.md` with purpose, key files, and implementation notes.
4) If the module needs storage, decide between `public.module_data` vs new tables (see `docs/module-authoring.md`).
5) Add summary endpoint(s) under `src/app/api/modules/<module-id>/summary/route.ts` so the module card can render.
6) Verify locally: `npm run lint` (and run the app if the change is UI-heavy).

## Access Model (Short)
- `cohort-approved`: application approved, unlocks billing.
- `cohort-access`: paid access, unlocks cohort tools and gated modules.
- `host` role: host-only UI and admin actions.

## Module Registry Notes
- Keep registry entries accurate; surfaces and summaries depend on it.
- For new modules, update `modules/registry.json` and follow `docs/module-authoring.md`.
- Use `access.entitlement` for gated modules.

## Stripe and Entitlements
- Stripe webhooks sync `cohort-access` entitlements.
- Billing module uses `cohort-approved` to unlock payment UI.
- Entitlements are read via `/api/me/entitlements`.

## Supabase Tips
- Migrations live in `supabase/migrations/`.
- Types are generated into `src/lib/types/db.ts` (see `supabase/README.md`).
- Storage bucket `avatars` must exist and be public.

## Architecture Decision Records
- `docs/adr/0001-module-registry.md`
