create unique index if not exists timeline_entries_user_source_unique_idx
  on public.timeline_entries (user_id, source_kind, source_ref)
  where source_kind is not null
    and source_ref is not null
    and source_ref ? 'event_id';
