-- One-time/backfill helper for historical email_referrals rows.
-- Safe to run repeatedly: duplicates are ignored by the outbox dedupe index.

create or replace function public.backfill_email_referral_outbox(
  p_limit int default 1000
)
returns integer
language sql
as $$
  with queued as (
    insert into public.integration_outbox (event_type, payload)
    select
      'email_referral.created',
      jsonb_build_object(
        'email_referral_id', er.id,
        'email', er.email,
        'referral', er.referral,
        'created_at', er.created_at
      )
    from public.email_referrals er
    where not exists (
      select 1
      from public.integration_outbox io
      where io.event_type = 'email_referral.created'
        and io.payload ->> 'email_referral_id' = er.id::text
    )
    order by er.created_at asc nulls first, er.id asc
    limit greatest(coalesce(p_limit, 1000), 0)
    on conflict do nothing
    returning 1
  )
  select count(*)::integer from queued;
$$;

