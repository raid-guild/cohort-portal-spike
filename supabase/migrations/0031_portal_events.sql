-- Persisted cross-module event bus (v1 baseline)

create extension if not exists "pgcrypto";

create table if not exists public.portal_events (
  id uuid primary key default gen_random_uuid(),
  module_id text not null,
  kind text not null,
  actor_id uuid null,
  subject jsonb null,
  data jsonb null,
  visibility text not null default 'authenticated'
    check (visibility in ('public', 'authenticated', 'private')),
  occurred_at timestamptz not null default now(),
  source text not null,
  dedupe_key text null,
  created_at timestamptz not null default now()
);

create index if not exists portal_events_occurred_idx
  on public.portal_events (occurred_at desc);

create index if not exists portal_events_kind_occurred_idx
  on public.portal_events (kind, occurred_at desc);

create index if not exists portal_events_module_occurred_idx
  on public.portal_events (module_id, occurred_at desc);

create index if not exists portal_events_actor_occurred_idx
  on public.portal_events (actor_id, occurred_at desc);

create unique index if not exists portal_events_module_dedupe_idx
  on public.portal_events (module_id, dedupe_key)
  where dedupe_key is not null;

alter table public.portal_events enable row level security;
