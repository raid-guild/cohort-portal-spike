alter table public.dao_blog_posts
  add column if not exists external_author_name text,
  add column if not exists external_author_avatar_url text;
