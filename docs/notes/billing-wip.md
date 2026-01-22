# Session Notes

This document captures the current state and next steps for the portal work.

## Core architecture
- Registry-driven modules live in `modules/registry.json` (source of truth).
- Module summaries use `src/components/ModuleSummary.tsx` with configurable layout options.
- Module isolation: dialog modules load in iframes with `?embed=1`; nav is hidden via `NavShell`.

## Key new features added
### Announcements
- API: `GET/POST /api/announcements` (role-based publishing; hosts can publish public/host; role-scoped publishes to own roles).
- Module page: `/modules/announcements` (public list; create form only when user has roles).
- Summary endpoint: `/api/modules/announcements/summary` (latest 3 items; list layout).
- Registry entry: `modules/registry.json` includes `presentation.layout: wide` + `height: double`.

### Profile generators (combined module)
- Module page: `/modules/profile-generators` (dialog module in Me Tools).
- APIs:
  - `POST /api/modules/profile-generators/generate-name` (Venice chat completion).
  - `POST /api/modules/profile-generators/generate-avatar` (Venice image generation, upload to avatars, update profile).
  - `GET /api/modules/profile-generators/summary` (returns avatar URL + display name).
- Uses portal-owned profile write API:
  - `POST /api/profile` (enforces `capabilities.profileWrite` from registry).
  - `GET /api/profile` (returns display_name + bio).

### Avatar uploads
- Direct client uploads blocked; use API `POST /api/avatars` (server-side upload with service role).
- `/me` avatar upload uses the API.

### Entitlements + gating
- Table: `public.entitlements` via `supabase/migrations/0004_entitlements.sql` + metadata column in `supabase/migrations/0005_entitlements_metadata.sql` + expires column in `supabase/migrations/0006_entitlements_expires_at.sql`.
- API: `GET /api/me/entitlements` returns `{ entitlements, records }` where `records` include `status`, `metadata`, `expires_at`. Endpoint filters to `status=active` and `expires_at` is null or in the future.
- Gating: `ModuleSurfaceList` filters modules by `access.entitlement` and hides modules that set `requiresAuth` without a session.
- Billing module: `/modules/billing` shows status, exposes `Refresh status`, and surfaces end dates for cancellations.
- Example entitlement: `cohort-access`.

## Summary rendering config
- `summary.layout`: `list` | `excerpt` | `compact`.
- `summary.maxItems`, `summary.truncate`, `summary.showTitle`.
- `summary.progressKey` renders a progress bar.
- `summary.imageKey` renders a circular thumbnail (compact layout).

## Access rules config
- `access.entitlement` in registry gates module visibility in surfaces.
- `capabilities` block documents module contracts (not enforced except `profileWrite`).
- Roles vs entitlements guidance: `docs/roles-vs-entitlements.md`.

## Venice AI integration
Env vars in `.env.local` / `.env.example`:
- `VENICE_API_KEY`
- `VENICE_MODEL` (text)
- `VENICE_IMAGE_MODEL` (image; default `venice-sd35`)
- `VENICE_API_BASE_URL` (defaults to `https://api.venice.ai/api/v1`)

## Known UX behavior
- Summaries refresh on `profile-updated` storage/message events.
- `/me` listens for `profile-updated` to reload profile.
- Nav avatar (`AuthLink`) refreshes on `profile-updated`.

## Docs updated
- `README.md` routes + env vars.
- `docs/kickoff-spec.md` announcements now module card.
- `docs/module-authoring.md` module isolation, summary options, access rules, capabilities.

## Stripe (implementation)
- Endpoints:
  - `POST /api/stripe/checkout` creates a Stripe Checkout Session for the cohort price.
  - `POST /api/stripe/portal` opens the Stripe Customer Portal.
  - `POST /api/stripe/webhook` verifies Stripe signatures and syncs entitlements.
- User mapping:
  - Checkout sessions set `client_reference_id` and metadata with the Supabase user id.
  - Stripe customers store `metadata.supabase_user_id` to resolve webhook events.
- Entitlement sync:
  - Webhook listens to `checkout.session.completed`, `customer.subscription.*`,
    and `invoice.*` to upsert `public.entitlements` for `cohort-access`.
  - Status is `active` for active/trialing subscriptions and `inactive` for cancellations
    or failed payments.
  - Entitlement metadata stores Stripe ids and cancellation info:
    `stripe_customer_id`, `stripe_subscription_id`, `cancel_at_period_end`,
    `cancel_at`, `current_period_end` (when available).
- Entitlements can optionally use `expires_at` for time-boxed access (ex: crypto USDC for 1 month).
- Stripe env vars:
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`,
    `STRIPE_PORTAL_CONFIG_ID` (optional)

## Stripe testing (local)
1) Start webhook relay:
   - `stripe listen --forward-to http://localhost:3000/api/stripe/webhook`
   - Copy the `whsec_...` into `STRIPE_WEBHOOK_SECRET` and restart Next.
2) Start checkout from `/modules/billing`.
   - Use test card: `4242 4242 4242 4242`, any future date, any CVC/ZIP.
3) Confirm entitlement:
   - Billing page shows `Status: Active` and gated modules appear.
4) Cancel in the Stripe portal:
   - Billing page should show `Ends on ...` (or `Cancels at period end`) after webhook.
   - Use `Refresh status` if needed to reload entitlements.

## Host testing helper
- Grant host role:
  - `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/make-host.js <user-id>`
  - Script also grants `cohort-approved` + `cohort-access` entitlements for parity.
- Example:
  - `SUPABASE_URL=https://project.supabase.co SUPABASE_SERVICE_ROLE_KEY=service-role-key node scripts/make-host.js d17ad505-3c38-4655-b937-bbc04d6e8511`

## Crypto mock (local)
- Endpoint: `POST /api/billing/crypto/mock`
- Requires `Authorization: Bearer <access_token>`.
- Upserts `cohort-access` with `expires_at = now + 30 days` and metadata `source=crypto-mock`.
- Use the Billing page button `Simulate USDC payment` to test the flow.

## Files to review
- `modules/registry.json`
- `src/components/ModuleSummary.tsx`
- `src/components/ModuleSurfaceList.tsx`
- `src/app/api/profile/route.ts`
- `src/app/api/me/entitlements/route.ts`
- `src/app/modules/profile-generators/page.tsx`
- `src/app/modules/billing/page.tsx`
- `supabase/migrations/0004_entitlements.sql`
- `supabase/migrations/0005_entitlements_metadata.sql`
- `supabase/migrations/0006_entitlements_expires_at.sql`
- `src/app/api/billing/crypto/mock/route.ts`


## New session kickoff prompt
Use this to resume work:

"You are picking up on Stripe billing and entitlements for the RaidGuild cohort portal. Read docs/billing-wip.md for context. Implement Stripe Checkout + Customer Portal + webhook syncing to public.entitlements (cohort-access). Wire Billing module buttons to the new endpoints. Ensure module gating uses access.entitlement and update docs as needed."
