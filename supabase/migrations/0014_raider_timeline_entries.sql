create table if not exists public.timeline_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null,
  title text not null,
  body text,
  visibility text not null default 'private',
  occurred_at timestamptz not null default now(),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  created_via_role text,
  source_kind text,
  source_ref jsonb,
  deleted_at timestamptz,
  constraint timeline_entries_kind_check check (kind in ('note','milestone','attendance')),
  constraint timeline_entries_visibility_check check (visibility in ('public','authenticated','private')),
  constraint timeline_entries_title_len check (char_length(title) <= 120),
  constraint timeline_entries_body_len check (body is null or char_length(body) <= 1000)
);

create index if not exists timeline_entries_user_occurred_idx
  on public.timeline_entries (user_id, occurred_at desc);

create index if not exists timeline_entries_user_pinned_occurred_idx
  on public.timeline_entries (user_id, pinned desc, occurred_at desc);

create index if not exists timeline_entries_visibility_idx
  on public.timeline_entries (visibility);

drop trigger if exists set_timeline_entries_updated_at on public.timeline_entries;
create trigger set_timeline_entries_updated_at
before update on public.timeline_entries
for each row execute function public.set_updated_at();

alter table public.timeline_entries enable row level security;

drop policy if exists "Timeline entries: public readable" on public.timeline_entries;
create policy "Timeline entries: public readable"
on public.timeline_entries
for select
using (visibility = 'public' and deleted_at is null);

drop policy if exists "Timeline entries: authenticated readable" on public.timeline_entries;
create policy "Timeline entries: authenticated readable"
on public.timeline_entries
for select
to authenticated
using (
  deleted_at is null
  and (
    visibility in ('public','authenticated')
    or user_id = auth.uid()
  )
);

drop policy if exists "Timeline entries: owner insert" on public.timeline_entries;
create policy "Timeline entries: owner insert"
on public.timeline_entries
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Timeline entries: owner update" on public.timeline_entries;
create policy "Timeline entries: owner update"
on public.timeline_entries
for update
to authenticated
using (user_id = auth.uid());

drop policy if exists "Timeline entries: owner delete" on public.timeline_entries;
create policy "Timeline entries: owner delete"
on public.timeline_entries
for delete
to authenticated
using (user_id = auth.uid());
