-- Member Forum module (spaces, posts, comments) with tiered read/write access.

create table if not exists public.forum_spaces (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  read_level text not null check (read_level in ('public', 'member', 'cohort')),
  write_level text not null check (write_level in ('member', 'cohort')),
  cohort_id uuid null references public.cohorts(id) on delete set null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.forum_spaces(id) on delete cascade,
  author_id uuid not null,
  title text not null,
  body_md text not null,
  is_locked boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.forum_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  author_id uuid not null,
  parent_comment_id uuid null references public.forum_comments(id) on delete cascade,
  body_md text not null,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_forum_spaces_slug on public.forum_spaces (slug);
create index if not exists idx_forum_spaces_read_level on public.forum_spaces (read_level);
create index if not exists idx_forum_posts_space_created on public.forum_posts (space_id, created_at desc);
create index if not exists idx_forum_posts_deleted on public.forum_posts (is_deleted);
create index if not exists idx_forum_comments_post_created on public.forum_comments (post_id, created_at asc);
create index if not exists idx_forum_comments_parent on public.forum_comments (parent_comment_id);
create index if not exists idx_forum_comments_deleted on public.forum_comments (is_deleted);

drop trigger if exists set_forum_spaces_updated_at on public.forum_spaces;
create trigger set_forum_spaces_updated_at
before update on public.forum_spaces
for each row execute function public.set_updated_at();

drop trigger if exists set_forum_posts_updated_at on public.forum_posts;
create trigger set_forum_posts_updated_at
before update on public.forum_posts
for each row execute function public.set_updated_at();

drop trigger if exists set_forum_comments_updated_at on public.forum_comments;
create trigger set_forum_comments_updated_at
before update on public.forum_comments
for each row execute function public.set_updated_at();

create or replace function public.has_active_entitlement(p_user_id uuid, p_entitlement text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.entitlements e
    where e.user_id = p_user_id
      and e.entitlement = p_entitlement
      and e.status = 'active'
      and (e.expires_at is null or e.expires_at > now())
  );
$$;

create or replace function public.is_host_user(p_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_user_id
      and ur.role in ('host', 'admin')
  );
$$;

create or replace function public.forum_can_read_space(space public.forum_spaces)
returns boolean
language sql
stable
as $$
  select case
    when space.read_level = 'public' then true
    when auth.uid() is null then false
    when space.read_level = 'member' then public.has_active_entitlement(auth.uid(), 'dao-member')
    when space.read_level = 'cohort' then public.has_active_entitlement(auth.uid(), 'cohort-access')
    else false
  end;
$$;

create or replace function public.forum_can_write_space(space public.forum_spaces)
returns boolean
language sql
stable
as $$
  select case
    when auth.uid() is null then false
    when space.write_level = 'member' then public.has_active_entitlement(auth.uid(), 'dao-member')
    when space.write_level = 'cohort' then public.has_active_entitlement(auth.uid(), 'cohort-access')
    else false
  end;
$$;

alter table public.forum_spaces enable row level security;
alter table public.forum_posts enable row level security;
alter table public.forum_comments enable row level security;

drop policy if exists "Forum spaces visible by read level" on public.forum_spaces;
create policy "Forum spaces visible by read level"
on public.forum_spaces
for select
using (public.forum_can_read_space(forum_spaces));

drop policy if exists "Forum spaces host moderation" on public.forum_spaces;
create policy "Forum spaces host moderation"
on public.forum_spaces
for all
using (auth.uid() is not null and public.is_host_user(auth.uid()))
with check (auth.uid() is not null and public.is_host_user(auth.uid()));

drop policy if exists "Forum posts visible in readable spaces" on public.forum_posts;
create policy "Forum posts visible in readable spaces"
on public.forum_posts
for select
using (
  is_deleted = false
  and exists (
    select 1
    from public.forum_spaces fs
    where fs.id = forum_posts.space_id
      and public.forum_can_read_space(fs)
  )
);

drop policy if exists "Forum posts writable in writable spaces" on public.forum_posts;
create policy "Forum posts writable in writable spaces"
on public.forum_posts
for insert
with check (
  auth.uid() = author_id
  and exists (
    select 1
    from public.forum_spaces fs
    where fs.id = forum_posts.space_id
      and public.forum_can_write_space(fs)
  )
);

drop policy if exists "Forum posts owner or host update" on public.forum_posts;
create policy "Forum posts owner or host update"
on public.forum_posts
for update
using (
  auth.uid() = author_id
  or (auth.uid() is not null and public.is_host_user(auth.uid()))
)
with check (
  auth.uid() = author_id
  or (auth.uid() is not null and public.is_host_user(auth.uid()))
);

drop policy if exists "Forum comments visible in readable post spaces" on public.forum_comments;
create policy "Forum comments visible in readable post spaces"
on public.forum_comments
for select
using (
  is_deleted = false
  and exists (
    select 1
    from public.forum_posts fp
    join public.forum_spaces fs on fs.id = fp.space_id
    where fp.id = forum_comments.post_id
      and fp.is_deleted = false
      and public.forum_can_read_space(fs)
  )
);

drop policy if exists "Forum comments writable in writable unlocked posts" on public.forum_comments;
create policy "Forum comments writable in writable unlocked posts"
on public.forum_comments
for insert
with check (
  auth.uid() = author_id
  and exists (
    select 1
    from public.forum_posts fp
    join public.forum_spaces fs on fs.id = fp.space_id
    where fp.id = forum_comments.post_id
      and fp.is_deleted = false
      and fp.is_locked = false
      and public.forum_can_write_space(fs)
  )
);

drop policy if exists "Forum comments owner or host update" on public.forum_comments;
create policy "Forum comments owner or host update"
on public.forum_comments
for update
using (
  auth.uid() = author_id
  or (auth.uid() is not null and public.is_host_user(auth.uid()))
)
with check (
  auth.uid() = author_id
  or (auth.uid() is not null and public.is_host_user(auth.uid()))
);
