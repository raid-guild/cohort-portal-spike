# Cohort Hub (v1)

This module provides a cohort dashboard with schedule, projects, resources, and
host-only notes. It is designed as a lightweight JSONB-backed hub.

## What ships in v1
- One active cohort at a time (plus one upcoming and all past cohorts).
- Participants get read-only access.
- Hosts can create/edit cohorts and JSON content.

## Data model
Tables:
- `public.cohorts`
- `public.cohort_content`

Content is stored as JSONB in `cohort_content`:
- `schedule`: `[{ day, date?, agenda?, notes? }]`
- `projects`: `[{ name, description?, team?[] }]`
- `resources`: `[{ title, url?, type? }]`
- `notes`: `[{ title, body }]` (host-only)

## Access & gating
- Module is gated by `cohort-access` entitlement.
- Hosts are granted `cohort-access` via `scripts/make-host.js`.

## APIs
- `GET /api/cohorts` (list active + next upcoming + all past)
- `POST /api/cohorts` (host-only create)
- `GET /api/cohorts/:id` (details)
- `PUT /api/cohorts/:id` (host-only update)

## Seeds
- `supabase/migrations/0010_seed_cohorts.sql` inserts an active cohort + content.

## Editing content
Hosts can edit the JSON directly in the hub’s editor panel. This is intentional
for v1 to move quickly without migrations.
