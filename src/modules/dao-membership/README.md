# DAO Membership Module

Purpose
- Let wallet-authenticated users claim imported DAO membership profiles.
- Display wallet-linked membership status and claim state.

Key files
- Module page: src/app/modules/dao-membership/page.tsx
- Module UI: src/modules/dao-membership/DaoMembershipModule.tsx
- Claim API: src/app/api/dao/claim/route.ts
- Summary API: src/app/api/modules/dao-membership/summary/route.ts
- Registry entry: modules/registry.json

Notes
- Uses explicit user action (`Claim profile`) rather than auto-claim.
- Reads wallet from Supabase auth identity metadata.
- Claim flow links `dao_memberships.user_id`, claims an unclaimed `profiles` row when available, and upserts `dao-member` entitlement.
