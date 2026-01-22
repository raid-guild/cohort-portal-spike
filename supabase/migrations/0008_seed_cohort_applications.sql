insert into public.cohort_applications (
  id,
  user_id,
  intent,
  goals,
  time_commitment,
  work_interest,
  past_work,
  status,
  signal_check_status,
  commitment_path,
  payment_status,
  applied_at
) values
  (
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'I want to build with the cohort and learn how RaidGuild ships.',
    'Ship a cohort project and build long-term collaborators.',
    '6-8 hours/week',
    'Dev + ops',
    'https://github.com/example/project',
    'submitted',
    'pending',
    null,
    'unpaid',
    now() - interval '2 days'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Looking to contribute design and UX to cohort projects.',
    'Join a small team and build a strong portfolio.',
    '4-6 hours/week',
    'Design',
    null,
    'approved',
    'complete',
    'guild',
    'unpaid',
    now() - interval '5 days'
  )
on conflict (id) do nothing;
