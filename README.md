# RaidGuild Portal Framework

A directory-first community portal for RaidGuild that centralizes profiles and curated modules into a single public home.

## Purpose
- Provide one cohesive portal URL with coherent navigation and SEO.
- Make profiles the core artifact (directory + public profiles).
- Let teams ship independently by registering modules (link or embed) with optional summaries.
- Support module-owned data via a simple portal API.

## What lives here
- Next.js App Router + TypeScript + Tailwind CSS.
- Module registry in `modules/registry.json` (source of truth for modules).
- Module surfaces driven by tags (`start-here`, `people-tools`, `profile-tools-public`, `me-tools`).
- Supabase auth + profiles + avatar storage + module data API.
- Shared dashboard shell with responsive left-rail/top-bar navigation.

## Routes
- `/` home and start-here modules
- `/people` public directory
- `/people/[handle]` public profile
- `/me` profile dashboard (auth required): read-only profile view, profile wizard, and modal profile editor
- `/modules` module directory
- `/modules/[id]` module detail (optional)
- `/modules/announcements` announcements module
- `/modules/billing` billing module
- `/modules/cohort-application` cohort application module
- `/modules/cohort-hub` cohort hub module
- `/modules/profile-generators` profile generators module
- `/modules/skills-explorer` skills explorer module
- `/api/modules` registry JSON
- `/api/health` deploy/smoke health check (returns ok + git sha)
- `/api/module-data` module data API
- `/api/announcements` announcements API
- `/api/cohorts` cohorts API
- `/api/cohort-applications` cohort applications API
- `/api/me/entitlements` entitlement status API
- `/api/me/roles` roles API
- `/api/profile` profile write API (portal-owned modules)
- `/api/stripe/checkout` Stripe Checkout session
- `/api/stripe/portal` Stripe Customer Portal session
- `/api/stripe/webhook` Stripe webhook for entitlements

## Getting started
```bash
npm install
npm run dev
```

## Scripts
- `npm run dev` start the app locally
- `npm run build` production build
- `npm run start` run the production build
- `npm run lint` lint
- `npm run sync:modules` sync registry into `public.modules` (Supabase)
- `npm run module:key` create a module key + hash (Supabase)
- `npm run snapshot:dao-members -- --dao <0xdao> --graph <graphql-endpoint>` write a DAO member snapshot JSON
- `npm run sync:dao-members -- --dao <0xdao> --chain <chain-id> --graph <graphql-endpoint>` sync `public.dao_memberships` + `dao-member` entitlements

### DAO snapshot script
Create a point-in-time membership snapshot before claim rollout:

```bash
npm run snapshot:dao-members -- \
  --dao 0xYourDaoAddress \
  --graph https://your-subgraph.example.com/subgraphs/name/dao
```

Env/flags:
- `DAO_ID` / `--dao`: DAO contract address (required).
- `DAO_GRAPH_URL` / `--graph`: GraphQL endpoint (required).
- `DAO_CHAIN_ID` / `--chain`: chain id (optional metadata).
- `DAO_PAGE_SIZE` / `--pageSize`: pagination batch size (default `500`).
- `DAO_GRAPH_API_KEY` / `--graphApiKey`: bearer token for protected graph endpoints.
- `DAO_INCLUDE_ZERO_POWER` / `--includeZeroPower`: include members with `shares + loot = 0` (default false).
- `DAO_SNAPSHOT_OUTPUT` / `--output`: output path (default `snapshots/dao-members-<dao>-<timestamp>.json`).
- `DAO_SEED_PROFILES` / `--seedProfiles`: if `true`, inserts missing claimable rows into `public.profiles` (requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`).
- `DAO_UPSERT_MEMBERSHIPS` / `--upsertMemberships`: if `true`, upserts `public.dao_memberships` (requires `--chain` + Supabase service-role envs).
- `DAO_SYNC_ENTITLEMENTS` / `--syncEntitlements`: if `true`, upserts `dao-member` entitlements for claimed rows.
- `DAO_DEACTIVATE_MISSING` / `--deactivateMissing`: if `true`, marks previously-active memberships inactive when missing from latest snapshot.

## Configuration
The portal expects Supabase for profile data, auth, and module data APIs.

Env vars:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VENICE_API_KEY` (profile generators)
- `VENICE_MODEL` (profile generators, text)
- `VENICE_IMAGE_MODEL` (profile generators, image)
- `VENICE_API_BASE_URL` (optional; defaults to `https://api.venice.ai/api/v1`)
- `GUILD_GRIMOIRE_TRANSCRIPTION_WEBHOOK_URL` (n8n/worker webhook for async audio transcription)
- `GUILD_GRIMOIRE_TRANSCRIPTION_WEBHOOK_KEY` (optional bearer token sent to webhook)
- `GUILD_GRIMOIRE_TRANSCRIPTION_CALLBACK_KEY` (required secret used by n8n callback endpoint)
- `STRIPE_SECRET_KEY` (billing)
- `STRIPE_WEBHOOK_SECRET` (billing)
- `STRIPE_PRICE_ID` (billing)
- `STRIPE_PORTAL_CONFIG_ID` (billing, optional)

Behavior notes:
- `/people` and `/people/[handle]` require Supabase data; configure envs and run migrations.
- `/me` requires Supabase auth; missing env vars will throw at runtime.

## Modules and data
- Module registry: `modules/registry.json`
- Module authoring guide: `docs/module-authoring.md`
- Module registry notes: `modules/README.md`
- Card sizing in surfaces is controlled by `presentation.layout`:
  - `compact`: small stats/data tile
  - `default`: standard stackable module card
  - `wide`: full-width module card
- Summary cards can also render dynamic widgets via `summary.layout: "widget"` and
  `summary.widget` (data-rendered or embedded iframe).

## Supabase
- Migrations and seeds live in `supabase/`
- Type generation and local auth notes: `supabase/README.md`
- Entitlements are stored in `public.entitlements` and used for module access gating.

## Docs
- Product kickoff: `docs/kickoff-spec.md`
- Architecture overview: `docs/architecture.md`
- Brand and UI tokens: `RG_BRAND_AGENTS.md`
- Cohort hub (v1): `docs/cohort-hub.md`
