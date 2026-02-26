create or replace function public.has_dao_blog_author_access(p_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_user_id
      and ur.role in ('host', 'admin')
  )
  or exists (
    select 1
    from public.entitlements e
    where e.user_id = p_user_id
      and e.entitlement = 'dao-member'
      and e.status = 'active'
      and (e.expires_at is null or e.expires_at > now())
  );
$$;

create table if not exists public.dao_blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  summary text not null,
  header_image_url text not null,
  body_md text not null,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'published')),
  published_at timestamptz,
  author_user_id uuid not null,
  review_submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint dao_blog_slug_kebab_case check (slug = lower(regexp_replace(slug, '[^a-z0-9]+', '-', 'g'))),
  constraint dao_blog_summary_len check (char_length(summary) <= 280)
);

drop trigger if exists set_dao_blog_posts_updated_at on public.dao_blog_posts;
create trigger set_dao_blog_posts_updated_at
before update on public.dao_blog_posts
for each row execute function public.set_updated_at();

create index if not exists dao_blog_posts_status_published_idx
  on public.dao_blog_posts (status, published_at desc)
  where deleted_at is null;

create index if not exists dao_blog_posts_author_idx
  on public.dao_blog_posts (author_user_id)
  where deleted_at is null;

alter table public.dao_blog_posts enable row level security;

create policy "DAO blog published posts readable by everyone"
on public.dao_blog_posts
for select
using (
  status = 'published'
  and deleted_at is null
);

create policy "DAO blog author draft visibility"
on public.dao_blog_posts
for select
using (
  auth.uid() is not null
  and deleted_at is null
  and (
    author_user_id = auth.uid()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('host', 'admin')
    )
  )
);

create policy "DAO blog authors can insert"
on public.dao_blog_posts
for insert
with check (
  auth.uid() is not null
  and author_user_id = auth.uid()
  and public.has_dao_blog_author_access(auth.uid())
);

create policy "DAO blog authors and hosts can update"
on public.dao_blog_posts
for update
using (
  auth.uid() is not null
  and (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('host', 'admin')
    )
    or (
      author_user_id = auth.uid()
      and status in ('draft', 'in_review')
      and public.has_dao_blog_author_access(auth.uid())
    )
  )
)
with check (
  auth.uid() is not null
  and (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('host', 'admin')
    )
    or (
      author_user_id = auth.uid()
      and status in ('draft', 'in_review')
      and public.has_dao_blog_author_access(auth.uid())
    )
  )
);
