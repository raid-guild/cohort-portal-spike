-- Generic integration outbox for async delivery (ex: SendGrid sync jobs)

create table if not exists public.integration_outbox (
  id bigint generated always as identity primary key,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.integration_outbox enable row level security;

create unique index if not exists integration_outbox_dedupe_email_referral_created_idx
  on public.integration_outbox (event_type, ((payload ->> 'email_referral_id')))
  where event_type = 'email_referral.created';

create index if not exists integration_outbox_pending_idx
  on public.integration_outbox (status, next_attempt_at, created_at);

create trigger integration_outbox_set_updated_at
before update on public.integration_outbox
for each row execute function public.set_updated_at();

create or replace function public.enqueue_email_referral_outbox()
returns trigger
language plpgsql
as $$
begin
  insert into public.integration_outbox (event_type, payload)
  values (
    'email_referral.created',
    jsonb_build_object(
      'email_referral_id', new.id,
      'email', new.email,
      'referral', new.referral,
      'created_at', new.created_at
    )
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists email_referrals_enqueue_outbox on public.email_referrals;
create trigger email_referrals_enqueue_outbox
after insert on public.email_referrals
for each row execute function public.enqueue_email_referral_outbox();
