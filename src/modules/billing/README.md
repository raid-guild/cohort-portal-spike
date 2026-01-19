# Billing & Access Module

Purpose
- Provide a portal-owned entry point for cohort subscription management.
- Surface entitlement status for paid-only modules.
- Support future alternative payment rails (ex: crypto) via shared entitlements.
 - Explain escrow mechanics and payment options in a low-anxiety layout.

Key files
- Module page: src/app/modules/billing/page.tsx
- Entitlements API: src/app/api/me/entitlements/route.ts
- Registry entry: modules/registry.json

Notes
- Stripe Checkout and Customer Portal are wired via `/api/stripe/checkout` and `/api/stripe/portal`.
- Webhook handler `/api/stripe/webhook` syncs `public.entitlements` for `cohort-access`.
- Stripe customers store `metadata.supabase_user_id` for webhook mapping.
- Entitlements can include `metadata.source` (ex: `stripe`, `crypto-mock`) and optional `expires_at`.
- Mock crypto endpoint: `POST /api/billing/crypto/mock` (sets 30-day access).
- Billing UI uses a summary card, unlocks list, payment options, and a "How this works" details panel.
