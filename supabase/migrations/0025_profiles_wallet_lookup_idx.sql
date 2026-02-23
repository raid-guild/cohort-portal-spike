create index if not exists profiles_wallet_address_lower_idx
  on public.profiles (lower(wallet_address))
  where wallet_address is not null;
