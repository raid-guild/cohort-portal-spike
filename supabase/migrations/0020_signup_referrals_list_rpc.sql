-- Signup Referrals module: list RPC with DB-level status filtering (converted / not_converted)

-- Speed up case-insensitive join on email.
create index if not exists profiles_email_lower_idx
  on public.profiles (lower(email));

-- Returns paginated referral rows with has_account computed from profiles.
-- NOTE: Uses offset pagination for MVP.
create or replace function public.signup_referrals_list(
  p_limit int,
  p_offset int,
  p_q text default '',
  p_status text default 'all'
)
returns table (
  id uuid,
  email text,
  referral text,
  created_at timestamptz,
  has_account boolean
)
language sql
stable
as $$
  with base as (
    select
      er.id,
      er.email,
      er.referral,
      er.created_at,
      coalesce(bool_or(p.user_id is not null), false) as has_account
    from public.email_referrals er
    left join public.profiles p
      on lower(p.email) = lower(er.email)
    where
      (
        coalesce(p_q, '') = ''
        or er.email ilike ('%' || p_q || '%') escape '\\'
        or er.referral ilike ('%' || p_q || '%') escape '\\'
      )
    group by er.id, er.email, er.referral, er.created_at
  )
  select
    base.id,
    base.email,
    base.referral,
    base.created_at,
    base.has_account
  from base
  where
    (
      p_status = 'all'
      or (
        p_status = 'converted'
        and base.has_account
      )
      or (
        p_status = 'not_converted'
        and not base.has_account
      )
    )
  order by base.created_at desc nulls last, base.id desc
  offset greatest(p_offset, 0)
  limit greatest(p_limit, 0);
$$;
