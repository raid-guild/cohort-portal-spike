# Supabase Setup

## Migrations
Store SQL migrations in `supabase/migrations/`.

## Seeds
Place initial data in `supabase/seed.sql`.

## Type Generation (use npx)
```bash
npx supabase gen types typescript --project-id <project-id> --schema public > src/lib/types/db.ts
```

## Notes
- Keep schema changes and generated types in this repo.
- Update this file if the workflow changes.
- Web3 identities cannot be linked via Supabase `linkIdentity` yet. Use email linking (`updateUser`) and store wallet addresses in profiles for now.

## Web3 Auth (Local Redirects)
If Web3 sign-in fails with a URI mismatch, add these in `supabase/config.toml` and restart:
```toml
[auth]
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://localhost:3000/**", "http://localhost:3000/me"]
```

## Storage (Avatars)
Create a public bucket named `avatars` for profile images.
- Local Studio: Storage → New bucket → `avatars` → Public
- Profiles store the public URL in `profiles.avatar_url`.

## Module Keys (for module_data API)
Module writes require a module key. Keys are stored as SHA-256 hashes in `public.module_keys`.

Generate a key + hash:
```bash
npm run module:key
```

Insert the hash:
```sql
insert into public.module_keys (module_id, key_hash)
values ('skills-explorer', '<sha256>');
```
