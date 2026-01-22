# Community Portal (Next.js) Kickoff Spec

## Context
This project is a flexible community portal framework: a single URL that hosts public profiles and a curated directory of modules built by internal and third-party teams. The portal provides a clean core profile system and a registry-driven module marketplace, with optional module data storage and role-based access control.

## Goals
1. Single portal URL with coherent navigation and SEO.
2. Profiles are core (directory + public profile pages).
3. Everything else ships as modules (link-outs or embeds) with optional summaries.
4. Modules can ship independently by editing the module registry.

## Tech Stack
Required:
- Next.js (App Router) + TypeScript
- Tailwind CSS (or similar)
- Vercel deployment

Version note:
- Use the latest stable Next.js. As of now: Next.js 16.1.1 via `npx create-next-app@latest`.

Next.js 16 highlights (see https://nextjs.org/blog/next-16):
- Cache Components
- Turbopack stable
- File system caching
- React Compiler support
- Smarter routing
- New caching APIs
- React 19.2 features

Optional (choose later):
- Auth: Supabase auth (email magic link + Web3)
- DB: Supabase (profiles + storage)
- Analytics: Plausible / PostHog
- RAG: existing stack later
- Client data fetching: React Query (optional, recommended for module summaries and data APIs)
- Modules registry sync (optional): sync `modules/registry.json` into `public.modules` for API queries

## Vercel Deployment Notes
- Use Vercel preview deploys for each PR to validate registry changes and module cards.
- Store environment variables in Vercel (Supabase URL/keys, analytics keys) and document them in `docs/`.
- Prefer `main` for production, `staging` (optional) for pre-prod.
- If using `npx supabase` in CI, add it to the build pipeline or a separate workflow.

## Supabase (recommended integration)
We should keep Supabase migrations and generated types in this repo for tight coupling between schema and app code.

Suggested structure:
- `supabase/migrations/` for SQL migrations
- `supabase/seed.sql` for initial data
- `src/lib/types/db.ts` for generated types
- Public storage bucket: `avatars` (for profile images)
- `public.modules` table synced from `modules/registry.json` (optional)
- `public.module_data` table for module-owned JSONB payloads
- `public.skill_catalog` and `public.role_catalog` for default profile options

Rationale:
- Single source of truth for schema + code
- Easier onboarding and previews
- Types versioned with schema changes

Type generation (use npx for Supabase CLI):
- `npx supabase gen types typescript --project-id <project-id> --schema public > src/lib/types/db.ts`
- See `supabase/README.md` for the current workflow.

Environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL` (server-side)
- `SUPABASE_SERVICE_ROLE_KEY` (server-side, for sync script)

## Branding Guide (RaidGuild)
Use `RG_BRAND_AGENTS.md` as the source of truth for brand tokens, typography, and component usage.

Key requirements:
- Use components from `src/components/*` and utilities from `src/app/globals.css`.
- Fonts: `maziusDisplay` (display), `ebGaramond` (body), `ubuntuMono` (mono).
- Use semantic tokens (primary, background, foreground) over hardcoded hex unless calling out palette values explicitly.
- Respect typography utilities (`type-*`) and avoid small-caps or forced uppercase in body/nav copy.
- Use `container-custom` and `grid-custom` for layout; preserve focus-visible rings and accessibility guidance.
- Use iconography from `public/assets` (D&D roles, magic glyphs, and 8bit icons) instead of emoji-only headings.

If the portal needs any new UI patterns, propose compositions of existing components first and update `RG_BRAND_AGENTS.md` if tokens or APIs change.

## Information Architecture
Core pages (portal-owned):
- `/` Home (portal theme, announcements, start-here modules)
- `/people` People directory (public)
- `/people/[handle]` Public profile ("flex page")
- `/me` Private profile editor (auth-gated)
- `/modules` Module directory (public/internal)

## Repo Layout
```txt
cohort-portal/
  src/
    app/
      layout.tsx
      page.tsx                   # Home
      people/
        page.tsx                 # Directory + people tools
        [handle]/
          page.tsx               # Public profile
      me/
        page.tsx                 # Profile editor + auth
      modules/
        page.tsx                 # Module directory
        [id]/
          page.tsx               # Module detail page (optional)
      api/
        modules/
          route.ts               # returns registry (json)
        people/
          route.ts               # public people API
        module-data/
          route.ts               # module data API

    components/
      Nav.tsx
      AuthLink.tsx
      ModuleCard.tsx
      ModuleDialogTrigger.tsx
      ModuleSummary.tsx
      ModuleSurfaceList.tsx
      ProfileHeader.tsx
      ProfileCompletionCard.tsx
      BadgePill.tsx

    lib/
      registry.ts                # loads registry
      people.ts                  # loads people (DB)
      supabase/
        client.ts
        server.ts
        admin.ts
      types.ts                   # shared types
      fonts.ts
      theme-context.tsx

  modules/
    registry.json                # source of truth for modules (MVP)
    README.md                    # how to add modules

  supabase/
    migrations/
    seed.sql
    README.md

  public/
    assets/
    iconography/
```

## Data Model (MVP)
Profiles are stored in Supabase with a flexible schema that supports core fields and future module summaries.

```ts
export type Profile = {
  userId?: string;
  handle: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  walletAddress?: string;
  email?: string;
  links?: { label: string; url: string }[];
  cohorts?: { id: string; role?: string; year?: number }[];
  skills?: string[];
  roles?: string[];
  location?: string;
  contact?: { farcaster?: string; telegram?: string; email?: string };
};
```

Storage:
- Supabase `profiles` table with RLS and storage bucket for avatars.
- Seed data lives in `supabase/seed.sql` for local development.

## Module Registry
The registry is the only thing the portal needs to know to surface modules.

Module types:
1. link (just a URL)
2. embed (iframe)

Module presentation (optional):
- `presentation.mode`: `card` (inline), `dialog` (opens modal), `drawer`, `page`
- `presentation.trigger`: `button`, `card`, `link`
- `presentation.iframe.height` for modal iframes
- `presentation.action`: `open` (default) or `none` to hide the action button

Module summary (optional):
- `summary.source`: `static` or `api`
- `summary.items`: label/value pairs to render on the card
- `summary.endpoint`: JSON endpoint that returns `{ title, items }`
- Use `summaryBySurface` for per-surface summaries with `{handle}` placeholder.

### Registry file
`/modules/registry.json`

## Page Specs
`/` Home
- Portal theme + dates
- "Start here" module cards (tagged `start-here`)
- Announcements are surfaced as a module card (portal-owned)

`/people` Directory
- Search by handle / name
- Filter by skill tags (basic)
- Sort: newest / alphabetical (basic)
- "People tools" module cards (tagged `people-tools`)

`/people/[handle]` Public Profile
- Profile header (name, avatar, links)
- Skills tags
- Roles tags
- Cohorts participated section
- "Profile tools" cards tagged `profile-tools-public`

`/modules` Module Directory
- Cards grouped by lane
- Filters: lane + status
- Card shows owner, status, type (link/embed)
- Optional `/modules/[id]` detail page

`/me` Profile Editor
- Auth required (Supabase email magic link or Web3)
- Manual profile creation (handle + display name)
- Avatar upload (Supabase Storage)
- Profile completion checklist
- Skills + roles multi-select from catalog tables
- "Profile tools" cards tagged `me-tools`

## Auth Strategy
Phase 0 (MVP):
- Supabase auth with email magic link + Web3 (Ethereum/Solana)
- `/me` is the authenticated profile editor (manual create step)
- Store wallet address + email on the profile (linking email via `updateUser`)
- Avatar upload stored in public `avatars` bucket

Phase 2:
- Shared JWT issuer so modules can trust portal auth (SSO-ish)

## Integration Contract for Lanes
Each lane can ship a module by doing one of these:

Level 1: Link
- Provide a URL
- Add registry entry

Level 2: Embed
- Provide URL embeddable in iframe
- Add `type: "embed"` + `embed.height`

## Module Data Contract (optional)
If a module needs storage in the core DB without migrations:
- Use `public.module_data` with JSONB payloads keyed by `module_id` + `user_id`.
- Visibility values: `public`, `authenticated`, `private`, `admin`.
- Prefer server-side writes via a portal API using a module key (do not expose keys to browsers).
- Sync curated module metadata into `public.modules` using `npm run sync:modules` when needed.
- Store module keys as SHA-256 hashes in `public.module_keys` (module owners keep the raw key).

Host-only modules:
- Tag modules with `hosts` and hide them unless the user has role `host`.
- Roles are stored in `public.user_roles` and assigned manually for now.

Example payload:
```json
{
  "module_id": "skills-explorer",
  "user_id": "uuid",
  "visibility": "public",
  "payload": {
    "skills": ["Solidity", "UX"],
    "graph": { "nodes": 42, "edges": 64 }
  }
}
```

Module Data API (portal-owned):
- `POST /api/module-data`
  - Headers: `x-module-id`, `x-module-key`
  - Body: `{ "userId": "uuid", "visibility": "public|authenticated|private|admin", "payload": {} }`
  - Writes via service role; module key required.
- `GET /api/module-data?module_id=...&user_id=...`
  - Optional `Authorization: Bearer <access_token>` to include `authenticated` + `private` rows.
  - Module key can read all rows for its module.

## Implementation Steps
Step 1 - Scaffold
- Create Next.js app (App Router)
- Tailwind
- Add registry loader + types
- Build `ModuleCard`, `Nav`

Step 2 - Registry-driven pages
- `/modules` renders registry
- `/` renders "start here" + lanes

Step 3 - Profiles
- Build `/people` and `/people/[handle]`
- Add Supabase `profiles` table + RLS + `avatars` storage bucket
- Wire `/me` profile editor + avatar upload

Step 5 - Module data (optional)
- Add `module_data` table with JSONB payloads and visibility (`public`, `authenticated`, `private`, `admin`)
- Optionally sync `modules/registry.json` into `public.modules` via `npm run sync:modules`

Step 6 - Governance
- Add `modules/README.md` describing how to add modules
- Add validation (zod) so registry does not break builds

## Definition of Done (MVP)
- Registry renders on `/modules`
- Home pulls modules by tags
- People directory works with search
- Public profile page exists
- Adding a new module requires only editing `registry.json`
- `/me` supports sign-in (email or Web3) and profile creation with avatar upload

## Open Questions
- Which modules should ship as internal pages vs external URLs?
- Do we want a registry schema validator (zod) before opening to third-party submissions?
