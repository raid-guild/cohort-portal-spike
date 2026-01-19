alter table public.entitlements
add column if not exists metadata jsonb;
