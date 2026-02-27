alter table public.cohorts
add column if not exists theme_long text;

alter table public.cohorts
add column if not exists header_image_url text;
