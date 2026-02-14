-- Signup Referrals module (email_referrals host/admin access)

-- Index for stable newest-first pagination
create index if not exists email_referrals_created_at_idx
  on public.email_referrals (created_at desc);

-- RLS: allow host/admin to read referrals
-- Table already has RLS enabled in 0012_email_referrals.sql.

drop policy if exists "Host/admin can view email referrals" on public.email_referrals;
create policy "Host/admin can view email referrals"
on public.email_referrals
for select
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('host','admin')
  )
);
