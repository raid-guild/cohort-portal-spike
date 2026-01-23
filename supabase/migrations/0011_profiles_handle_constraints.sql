alter table public.profiles
  add constraint profiles_handle_not_empty
  check (length(trim(handle)) > 0)
  not valid;
