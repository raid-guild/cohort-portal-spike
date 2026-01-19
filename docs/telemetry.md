# Telemetry & Events (Future)

This document captures a future approach for event tracking across the portal,
including billing, crypto payments, and operational analytics.

## Goals
- Track billing and payment lifecycle events without a table per feature.
- Keep data queryable for user support and analytics.
- Allow flexible metadata while preserving typed fields for indexing.

## Proposed Generic Events Table
Suggested table name: `public.events`

Core columns (typed for indexing and query performance):
- `id uuid primary key default gen_random_uuid()`
- `category text` (ex: `billing`, `profile`, `auth`, `module`)
- `event_type text` (ex: `stripe.invoice.paid`, `crypto.transfer.confirmed`)
- `source text` (ex: `stripe`, `crypto`, `portal`)
- `user_id uuid null`
- `entitlement text null`
- `amount numeric null`
- `currency text null`
- `occurred_at timestamptz not null default now()`
- `external_id text null` (ex: Stripe event id, tx hash)
- `metadata jsonb null`

Recommended indexes:
- `(category, occurred_at desc)`
- `(user_id, occurred_at desc)`
- unique `(source, external_id)` to avoid duplicates

## Billing Events (example)
When a Stripe webhook fires:
- `category = "billing"`
- `event_type = "stripe.invoice.paid"` (or the raw webhook event)
- `source = "stripe"`
- `user_id = <supabase_user_id>`
- `entitlement = "cohort-access"`
- `amount = invoice.total / 100`
- `currency = invoice.currency`
- `external_id = event.id`
- `metadata` can store Stripe customer/subscription ids, period boundaries, etc.

For crypto:
- `event_type = "crypto.transfer.confirmed"`
- `source = "crypto"`
- `external_id = tx hash`
- `metadata` can store chain, token, payer address, memo, relayer id.

## Entitlements Summary (optional)
If event volume grows, keep entitlements as the current source of truth for access,
and use events only for history and analytics. This keeps runtime gating fast.

## Notes
- Start with a single events table and add views/materialized summaries later.
- Partitioning can be considered if volume grows (monthly partitions).
