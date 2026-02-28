create or replace function public.enforce_poll_open_for_vote()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.polls p
    where p.id = new.poll_id
      and p.status = 'open'
      and now() >= p.opens_at
      and now() < p.closes_at
  ) then
    raise exception 'Poll is not open for voting.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_poll_open_for_vote on public.poll_votes;
create trigger enforce_poll_open_for_vote
before insert or update on public.poll_votes
for each row execute function public.enforce_poll_open_for_vote();
