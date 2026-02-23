# DAO Member Dashboard Module

Purpose
- Provide a member-only dashboard for DAO metrics: shares, loot, voting power, and active memberships.
- Keep claim/linking flows in `dao-membership` while this module focuses on ongoing member visibility.

Key files
- Module page: src/app/modules/dao-member-dashboard/page.tsx
- Module UI: src/modules/dao-member-dashboard/DaoMemberDashboard.tsx
- Overview API: src/app/api/modules/dao-member-dashboard/overview/route.ts
- Summary API: src/app/api/modules/dao-member-dashboard/summary/route.ts
- Shared API helpers: src/app/api/modules/dao-member-dashboard/lib.ts
- Registry entry: modules/registry.json

Notes
- Access is gated by `dao-member` entitlement in both surface placement and API routes.
- Data source is `public.dao_memberships` rows linked to `user_id`.
