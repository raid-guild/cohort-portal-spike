alter table public.entitlements
add column if not exists expires_at timestamptz;
