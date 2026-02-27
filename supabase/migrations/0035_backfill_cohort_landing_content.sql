update public.cohorts
set theme_long = case name
  when 'Cohort X' then 'Dust and mudd.'
  when 'Cohort XI' then 'x402 facilitators.'
  when 'Cohort XII' then 'x402 usecase exploration sprint.'
  when 'Cohort XIII' then 'Agents, Assistants and Automations. Working with OpenClaw.'
  when 'Cohort XIV' then 'Real World AI Automation and distributed systems.'
  else theme_long
end
where theme_long is null;
