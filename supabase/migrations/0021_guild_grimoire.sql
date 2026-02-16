-- Guild Grimoire (lightweight field notes)

create table if not exists public.guild_grimoire_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  content_type text not null,
  text_content text null,
  image_url text null,
  audio_url text null,
  audio_duration_sec int null,
  visibility text not null default 'shared',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint guild_grimoire_notes_content_type_check check (content_type in ('text','image','audio')),
  constraint guild_grimoire_notes_visibility_check check (visibility in ('private','shared','cohort','public')),
  constraint guild_grimoire_notes_text_length check (text_content is null or char_length(text_content) <= 256),
  constraint guild_grimoire_notes_one_mode check (
    (content_type = 'text' and text_content is not null and image_url is null and audio_url is null)
    or
    (content_type = 'image' and image_url is not null and text_content is null and audio_url is null)
    or
    (content_type = 'audio' and audio_url is not null and text_content is null and image_url is null)
  )
);

create index if not exists idx_guild_grimoire_notes_created_at on public.guild_grimoire_notes (created_at desc);
create index if not exists idx_guild_grimoire_notes_user_id on public.guild_grimoire_notes (user_id);
create index if not exists idx_guild_grimoire_notes_visibility on public.guild_grimoire_notes (visibility);
create index if not exists idx_guild_grimoire_notes_deleted_at on public.guild_grimoire_notes (deleted_at);

drop trigger if exists set_guild_grimoire_notes_updated_at on public.guild_grimoire_notes;
create trigger set_guild_grimoire_notes_updated_at
before update on public.guild_grimoire_notes
for each row execute function public.set_updated_at();

alter table public.guild_grimoire_notes enable row level security;

-- Reads are mediated by Next.js API for v1; keep policies conservative.
-- Allow selecting non-deleted shared/public notes for any authenticated user.
create policy "Guild grimoire shared/public notes are viewable"
on public.guild_grimoire_notes
for select
to authenticated
using (
  deleted_at is null
  and visibility in ('shared','public','cohort')
);

-- Allow selecting own notes (including private), even if deleted (so clients can verify ownership).
create policy "Guild grimoire owners can view their notes"
on public.guild_grimoire_notes
for select
to authenticated
using (user_id = auth.uid());

-- Writes should go through Next.js API routes using the Supabase service role.

create table if not exists public.guild_grimoire_tags (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  label text unique not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  is_active boolean not null default true
);

create index if not exists idx_guild_grimoire_tags_is_active on public.guild_grimoire_tags (is_active);

alter table public.guild_grimoire_tags enable row level security;

create policy "Guild grimoire tags are viewable"
on public.guild_grimoire_tags
for select
to authenticated
using (is_active = true);

create table if not exists public.guild_grimoire_note_tags (
  note_id uuid not null references public.guild_grimoire_notes(id) on delete cascade,
  tag_id uuid not null references public.guild_grimoire_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (note_id, tag_id)
);

create index if not exists idx_guild_grimoire_note_tags_tag_id on public.guild_grimoire_note_tags (tag_id);

alter table public.guild_grimoire_note_tags enable row level security;

create policy "Guild grimoire note tags are viewable"
on public.guild_grimoire_note_tags
for select
to authenticated
using (true);
