alter table public.cohorts
add column if not exists slug text;

update public.cohorts
set slug = trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'))
where slug is null;

create unique index if not exists cohorts_slug_unique_idx
  on public.cohorts (slug)
  where slug is not null;
