insert into public.cohorts (id, name, status, start_at, end_at)
values
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'Cohort Alpha',
    'active',
    now() - interval '7 days',
    now() + interval '6 weeks'
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'Cohort Beta',
    'upcoming',
    now() + interval '8 weeks',
    now() + interval '14 weeks'
  )
on conflict (id) do nothing;

insert into public.cohort_content (
  cohort_id,
  schedule,
  projects,
  resources,
  notes
) values (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '[
    { "day": 1, "date": "Day 1", "agenda": "Welcome, onboarding, and team formation." },
    { "day": 2, "date": "Day 2", "agenda": "Project scoping + first milestones." },
    { "day": 3, "date": "Day 3", "agenda": "Mentor reviews and progress check-ins." }
  ]'::jsonb,
  '[
    { "name": "Project Atlas", "description": "Cohort mapping and skills graph.", "team": ["Alice", "Ben"] },
    { "name": "Project Forge", "description": "Prototype a guild onboarding flow.", "team": ["Cass", "Dee"] }
  ]'::jsonb,
  '[
    { "title": "Cohort handbook", "url": "https://example.com/handbook", "type": "doc" },
    { "title": "Weekly sync agenda", "url": "https://example.com/agenda", "type": "doc" }
  ]'::jsonb,
  '[
    { "title": "Host notes", "body": "Confirm mentor availability for week 2." }
  ]'::jsonb
) on conflict (cohort_id) do nothing;
