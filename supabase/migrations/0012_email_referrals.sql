create table if not exists public.email_referrals (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  referral text,
  created_at timestamptz default now()
);

create unique index if not exists email_referrals_email_unique_idx
  on public.email_referrals (lower(email));

alter table public.email_referrals enable row level security;
