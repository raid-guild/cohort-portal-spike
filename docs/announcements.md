# Announcements (Spec Notes)

Announcements should be treated as a core portal feature rather than module data. They are global, role-aware, and benefit from scheduling and strong visibility rules enforced server-side.

## Recommended approach (core table + portal API)
Create a dedicated `announcements` table and a portal API that enforces visibility and role targeting.

Suggested fields:
- `id` (uuid, primary key)
- `title` (text)
- `body` (text or markdown)
- `status` (`draft` | `published`)
- `audience` (`public` | `authenticated` | `host`)
- `role_targets` (text[]; optional, for targeting specific roles)
- `starts_at` (timestamptz; optional)
- `ends_at` (timestamptz; optional)
- `created_by` (uuid)
- `created_at`, `updated_at` (timestamptz)

API behavior:
- `GET /api/announcements` returns only announcements the current viewer is allowed to see.
- Visibility and role checks happen in the portal API layer (not in client code).
- Scheduling filters should exclude items outside `starts_at`/`ends_at`.

## Alternative (module_data)
If a host module must own announcements, store them as `module_data` payloads under a fixed module id (for example, `announcements`). The portal API still must enforce:
- role targeting
- audience rules
- scheduling

This keeps a consistent contract but makes querying and scheduling more complex than a core table.
