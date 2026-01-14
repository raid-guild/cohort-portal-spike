# Announcements Module

Purpose
- Provide a portal-owned surface for cohort announcements.
- Allow role-based publishing (hosts can publish to public/host; others publish to their roles).

Key files
- Page: src/app/modules/announcements/page.tsx
- Admin UI: src/modules/announcements/AnnouncementsAdmin.tsx
- List UI: src/modules/announcements/AnnouncementsList.tsx
- API: src/app/api/announcements/route.ts
- Summary API: src/app/api/modules/announcements/summary/route.ts

Notes
- Visibility is enforced in the API using audience, role targets, and scheduling.
- The module card summary shows the latest items via the summary endpoint.
- The create form renders only for users who have at least one role.
