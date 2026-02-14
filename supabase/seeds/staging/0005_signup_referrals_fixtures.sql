-- Staging seed: Signup Referrals fixtures
-- Idempotent: upsert by id.

-- Ensure staging personas have user_roles rows (used by host-only modules)
insert into public.user_roles (user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'host'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'admin')
on conflict (user_id, role) do nothing;

-- Create deterministic referral rows (mix of converted/unconverted)
insert into public.email_referrals (id, email, referral, created_at) values
  ('10000000-0000-0000-0000-000000000001', 'staging-host@example.com', 'discord', now() - interval '30 days'),
  ('10000000-0000-0000-0000-000000000002', 'staging-contributor@example.com', 'x', now() - interval '29 days'),
  ('10000000-0000-0000-0000-000000000003', 'signup-003@example.com', 'telegram', now() - interval '28 days'),
  ('10000000-0000-0000-0000-000000000004', 'signup-004@example.com', 'friend', now() - interval '27 days'),
  ('10000000-0000-0000-0000-000000000005', 'signup-005@example.com', 'discord', now() - interval '26 days'),
  ('10000000-0000-0000-0000-000000000006', 'signup-006@example.com', 'website', now() - interval '25 days'),
  ('10000000-0000-0000-0000-000000000007', 'signup-007@example.com', 'x', now() - interval '24 days'),
  ('10000000-0000-0000-0000-000000000008', 'signup-008@example.com', 'discord', now() - interval '23 days'),
  ('10000000-0000-0000-0000-000000000009', 'signup-009@example.com', 'telegram', now() - interval '22 days'),
  ('10000000-0000-0000-0000-000000000010', 'signup-010@example.com', 'friend', now() - interval '21 days'),
  ('10000000-0000-0000-0000-000000000011', 'signup-011@example.com', 'website', now() - interval '20 days'),
  ('10000000-0000-0000-0000-000000000012', 'signup-012@example.com', 'discord', now() - interval '19 days'),
  ('10000000-0000-0000-0000-000000000013', 'signup-013@example.com', 'x', now() - interval '18 days'),
  ('10000000-0000-0000-0000-000000000014', 'signup-014@example.com', 'telegram', now() - interval '17 days'),
  ('10000000-0000-0000-0000-000000000015', 'signup-015@example.com', 'friend', now() - interval '16 days'),
  ('10000000-0000-0000-0000-000000000016', 'signup-016@example.com', 'discord', now() - interval '15 days'),
  ('10000000-0000-0000-0000-000000000017', 'signup-017@example.com', null, now() - interval '14 days'),
  ('10000000-0000-0000-0000-000000000018', 'signup-018@example.com', 'website', now() - interval '13 days'),
  ('10000000-0000-0000-0000-000000000019', 'signup-019@example.com', 'x', now() - interval '12 days'),
  ('10000000-0000-0000-0000-000000000020', 'signup-020@example.com', 'discord', now() - interval '11 days'),
  ('10000000-0000-0000-0000-000000000021', 'signup-021@example.com', 'telegram', now() - interval '10 days'),
  ('10000000-0000-0000-0000-000000000022', 'signup-022@example.com', 'friend', now() - interval '9 days'),
  ('10000000-0000-0000-0000-000000000023', 'signup-023@example.com', 'website', now() - interval '8 days'),
  ('10000000-0000-0000-0000-000000000024', 'signup-024@example.com', 'discord', now() - interval '7 days'),
  ('10000000-0000-0000-0000-000000000025', 'signup-025@example.com', 'x', now() - interval '6 days'),
  ('10000000-0000-0000-0000-000000000026', 'signup-026@example.com', 'telegram', now() - interval '5 days'),
  ('10000000-0000-0000-0000-000000000027', 'signup-027@example.com', 'friend', now() - interval '4 days'),
  ('10000000-0000-0000-0000-000000000028', 'signup-028@example.com', 'website', now() - interval '3 days'),
  ('10000000-0000-0000-0000-000000000029', 'signup-029@example.com', 'discord', now() - interval '2 days'),
  ('10000000-0000-0000-0000-000000000030', 'signup-030@example.com', 'x', now() - interval '1 day')
on conflict (id) do update set
  email = excluded.email,
  referral = excluded.referral,
  created_at = excluded.created_at;
