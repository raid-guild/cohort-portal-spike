-- Backfill Cohort Hub records from historical notes.
-- Destructive reset: clears current cohort hub records before inserting this dataset.
-- Status mapping used for Cohort Hub visibility:
-- - completed -> archived
-- - in progress -> active

delete from public.cohort_content;
delete from public.cohorts;

insert into public.cohorts (id, name, status, start_at, end_at)
values
  (
    'c1000000-0000-0000-0000-000000000010',
    'Cohort X',
    'archived',
    null,
    null
  ),
  (
    'c1000000-0000-0000-0000-000000000011',
    'Cohort XI',
    'archived',
    '2025-12-01T00:00:00Z'::timestamptz,
    '2025-12-31T00:00:00Z'::timestamptz
  ),
  (
    'c1000000-0000-0000-0000-000000000012',
    'Cohort XII',
    'archived',
    '2026-01-01T00:00:00Z'::timestamptz,
    '2026-01-31T00:00:00Z'::timestamptz
  ),
  (
    'c1000000-0000-0000-0000-000000000013',
    'Cohort XIII',
    'active',
    '2026-02-01T00:00:00Z'::timestamptz,
    '2026-02-28T00:00:00Z'::timestamptz
  ),
  (
    'c1000000-0000-0000-0000-000000000014',
    'Cohort XIV',
    'upcoming',
    '2026-03-02T00:00:00Z'::timestamptz,
    null
  );

insert into public.cohort_content (
  cohort_id,
  schedule,
  projects,
  resources,
  notes
)
values
  (
    'c1000000-0000-0000-0000-000000000010',
    '[]'::jsonb,
    '[
      { "name": "Dust and mudd", "description": "Cohort X theme exploration track." }
    ]'::jsonb,
    '[
      { "title": "Dust and mudd", "type": "theme" },
      { "title": "Demo", "url": "https://youtu.be/MUjxvYTf8qg", "type": "video" }
    ]'::jsonb,
    '[
      { "title": "Theme", "body": "Dust and mudd." }
    ]'::jsonb
  ),
  (
    'c1000000-0000-0000-0000-000000000011',
    '[]'::jsonb,
    '[
      { "name": "x402 Dashboard", "description": "Hosted dashboard implementation for x402 facilitators." },
      { "name": "oneclick x402 facilitator deploy", "description": "One-click deployment flow for x402 facilitator tooling." }
    ]'::jsonb,
    '[
      { "title": "x402 Dashboard (repo)", "url": "https://github.com/raid-guild/cohort10-next-x402-dashboard", "type": "repo" },
      { "title": "oneclick x402 facilitator deploy (repo)", "url": "https://github.com/raid-guild/x402-facilitator-go", "type": "repo" },
      { "title": "Resources and Brown bags", "url": "https://hackmd.io/@Dekan/S1eLO2ryF-g", "type": "doc" },
      { "title": "Demos", "url": "https://www.youtube.com/watch?v=3f7kPqBk5t8", "type": "video" }
    ]'::jsonb,
    '[
      { "title": "Theme", "body": "x402 facilitators." }
    ]'::jsonb
  ),
  (
    'c1000000-0000-0000-0000-000000000012',
    '[]'::jsonb,
    '[
      { "name": "x402 product", "description": "x402 use-case exploration sprint project repo." }
    ]'::jsonb,
    '[
      { "title": "x402 product (repo)", "url": "https://github.com/raid-guild/x402-product", "type": "repo" },
      { "title": "Resources and Brown bags", "url": "https://youtu.be/RjfpDlzdnbk", "type": "video" },
      { "title": "Demos", "url": "https://youtu.be/O4gtGkGpSbU", "type": "video" }
    ]'::jsonb,
    '[
      { "title": "Theme", "body": "x402 usecase exploration sprint." }
    ]'::jsonb
  ),
  (
    'c1000000-0000-0000-0000-000000000013',
    '[]'::jsonb,
    '[
      { "name": "cohort-portal-spike", "description": "Agent/assistant automation spike for cohort operations." }
    ]'::jsonb,
    '[
      { "title": "cohort-portal-spike (repo)", "url": "https://github.com/raid-guild/cohort-portal-spike", "type": "repo" },
      { "title": "Resources and Brown bags", "url": "https://youtu.be/GFjE9QOn0lE", "type": "video" }
    ]'::jsonb,
    '[
      { "title": "Theme", "body": "Agents, Assistants and Automations." },
      { "title": "Focus", "body": "Working with OpenClaw." }
    ]'::jsonb
  ),
  (
    'c1000000-0000-0000-0000-000000000014',
    '[
      { "day": 1, "date": "2026-03-02", "agenda": "Kickoff (Monday)." }
    ]'::jsonb,
    '[]'::jsonb,
    '[
      { "title": "Sponsor: Pinata", "url": "https://pinata.cloud/", "type": "sponsor" }
    ]'::jsonb,
    '[
      { "title": "Theme", "body": "Real World AI Automation and distributed systems." }
    ]'::jsonb
  );
