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

## Routes
- `/` home and start-here modules
- `/people` public directory
- `/people/[handle]` public profile
- `/me` profile editor (auth required)
- `/modules` module directory
- `/modules/[id]` module detail (optional)
- `/modules/announcements` announcements module
- `/modules/profile-generators` profile generators module
- `/api/modules` registry JSON
- `/api/module-data` module data API
- `/api/announcements` announcements API
- `/api/profile` profile write API (portal-owned modules)

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

Behavior notes:
- `/people` and `/people/[handle]` require Supabase data; configure envs and run migrations.
- `/me` requires Supabase auth; missing env vars will throw at runtime.

## Modules and data
- Module registry: `modules/registry.json`
- Module authoring guide: `docs/module-authoring.md`
- Module registry notes: `modules/README.md`

## Supabase
- Migrations and seeds live in `supabase/`
- Type generation and local auth notes: `supabase/README.md`

## Docs
- Product kickoff and architecture: `docs/kickoff-spec.md`
- Brand and UI tokens: `RG_BRAND_AGENTS.md`
