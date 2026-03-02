create or replace function public.sync_cohort_relationships(
  p_cohort_id uuid,
  p_sync_participants boolean default false,
  p_participants jsonb default '[]'::jsonb,
  p_sync_partners boolean default false,
  p_partners jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_sync_participants then
    delete from public.cohort_participants
    where cohort_id = p_cohort_id;

    if jsonb_typeof(p_participants) = 'array' and jsonb_array_length(p_participants) > 0 then
      insert into public.cohort_participants (cohort_id, user_id, role, status, sort_order)
      select
        p_cohort_id,
        participant.user_id,
        participant.role,
        participant.status,
        participant.sort_order
      from jsonb_to_recordset(p_participants) as participant(
        user_id uuid,
        role text,
        status text,
        sort_order integer
      );
    end if;
  end if;

  if p_sync_partners then
    delete from public.cohort_partners
    where cohort_id = p_cohort_id;

    if jsonb_typeof(p_partners) = 'array' and jsonb_array_length(p_partners) > 0 then
      insert into public.cohort_partners (
        cohort_id,
        name,
        logo_url,
        description,
        website_url,
        crm_account_id,
        display_order
      )
      select
        p_cohort_id,
        partner.name,
        partner.logo_url,
        coalesce(partner.description, ''),
        partner.website_url,
        partner.crm_account_id,
        coalesce(partner.display_order, 0)
      from jsonb_to_recordset(p_partners) as partner(
        name text,
        logo_url text,
        description text,
        website_url text,
        crm_account_id uuid,
        display_order integer
      )
      where nullif(trim(partner.name), '') is not null;
    end if;
  end if;
end;
$$;
