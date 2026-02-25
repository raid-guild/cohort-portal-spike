-- Staging seed: Relationship CRM fixtures
-- Idempotent deterministic data for host + dao-member + unauthorized personas.

-- Ensure persona bindings exist.
insert into public.user_roles (user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'host'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'admin')
on conflict (user_id, role) do nothing;

insert into public.entitlements (user_id, entitlement, status) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'dao-member', 'active')
on conflict (user_id, entitlement) do update set
  status = excluded.status,
  updated_at = now();

insert into public.relationship_crm_accounts (
  id,
  name,
  relationship_type,
  stage,
  status,
  owner_user_id,
  next_follow_up_at,
  notes,
  created_by,
  created_at,
  updated_at,
  deleted_at
) values
  (
    '91000000-0000-0000-0000-000000000001',
    'MetaCartel Labs',
    'sponsor',
    'proposal',
    'active',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    now() + interval '1 day',
    'Sponsorship discussion in progress for next cohort.',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    now() - interval '8 days',
    now() - interval '2 hours',
    null
  ),
  (
    '91000000-0000-0000-0000-000000000002',
    'Agency Neon',
    'agency-client',
    'negotiation',
    'active',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    now() - interval '1 day',
    'Waiting on contract redlines.',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    now() - interval '6 days',
    now() - interval '1 hour',
    null
  ),
  (
    '91000000-0000-0000-0000-000000000003',
    'Builders Collective',
    'partner',
    'closed-won',
    'inactive',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    null,
    'Converted to long-term delivery partner.',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    now() - interval '20 days',
    now() - interval '5 days',
    null
  )
on conflict (id) do update set
  name = excluded.name,
  relationship_type = excluded.relationship_type,
  stage = excluded.stage,
  status = excluded.status,
  owner_user_id = excluded.owner_user_id,
  next_follow_up_at = excluded.next_follow_up_at,
  notes = excluded.notes,
  created_by = excluded.created_by,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at;

insert into public.relationship_crm_contacts (
  id,
  account_id,
  full_name,
  role_title,
  email,
  phone,
  preferred_channel,
  is_primary,
  created_at,
  updated_at
) values
  (
    '92000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000001',
    'Sam Carter',
    'Partnership Lead',
    'sam@metacartel.example',
    null,
    'email',
    true,
    now() - interval '8 days',
    now() - interval '8 days'
  ),
  (
    '92000000-0000-0000-0000-000000000002',
    '91000000-0000-0000-0000-000000000002',
    'Jordan Lee',
    'COO',
    'jordan@agencyneon.example',
    null,
    'telegram',
    true,
    now() - interval '6 days',
    now() - interval '6 days'
  )
on conflict (id) do update set
  account_id = excluded.account_id,
  full_name = excluded.full_name,
  role_title = excluded.role_title,
  email = excluded.email,
  phone = excluded.phone,
  preferred_channel = excluded.preferred_channel,
  is_primary = excluded.is_primary,
  updated_at = excluded.updated_at;

insert into public.relationship_crm_interactions (
  id,
  account_id,
  contact_id,
  interaction_type,
  summary,
  interaction_at,
  created_by,
  created_at
) values
  (
    '93000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000001',
    'meeting',
    'Reviewed sponsorship tiers and timeline.',
    now() - interval '2 days',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    now() - interval '2 days'
  ),
  (
    '93000000-0000-0000-0000-000000000002',
    '91000000-0000-0000-0000-000000000002',
    '92000000-0000-0000-0000-000000000002',
    'call',
    'Discussed redline response and revised SOW.',
    now() - interval '1 day',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    now() - interval '1 day'
  )
on conflict (id) do update set
  account_id = excluded.account_id,
  contact_id = excluded.contact_id,
  interaction_type = excluded.interaction_type,
  summary = excluded.summary,
  interaction_at = excluded.interaction_at,
  created_by = excluded.created_by;

insert into public.relationship_crm_tasks (
  id,
  account_id,
  assignee_user_id,
  title,
  due_at,
  status,
  created_by,
  completed_at,
  created_at,
  updated_at
) values
  (
    '94000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Send sponsorship draft agreement',
    now() + interval '10 hours',
    'open',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    null,
    now() - interval '1 day',
    now() - interval '1 day'
  ),
  (
    '94000000-0000-0000-0000-000000000002',
    '91000000-0000-0000-0000-000000000002',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'Follow up on contract redline comments',
    now() - interval '4 hours',
    'open',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    null,
    now() - interval '16 hours',
    now() - interval '16 hours'
  ),
  (
    '94000000-0000-0000-0000-000000000003',
    '91000000-0000-0000-0000-000000000003',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Archive kickoff notes',
    now() - interval '3 days',
    'done',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    now() - interval '2 days',
    now() - interval '5 days',
    now() - interval '2 days'
  )
on conflict (id) do update set
  account_id = excluded.account_id,
  assignee_user_id = excluded.assignee_user_id,
  title = excluded.title,
  due_at = excluded.due_at,
  status = excluded.status,
  completed_at = excluded.completed_at,
  created_by = excluded.created_by,
  updated_at = excluded.updated_at;
