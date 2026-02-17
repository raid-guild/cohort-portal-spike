# Guild Grimoire Module

Purpose
- Let signed-in users post short field updates as text, image, or audio notes.
- Provide a shared feed with lightweight filters for quick community browsing.

Key files
- Module page: src/app/modules/guild-grimoire/page.tsx
- Module UI: src/modules/guild-grimoire/GuildGrimoire.tsx
- Types: src/modules/guild-grimoire/types.ts
- Feed API: src/app/api/modules/guild-grimoire/feed/route.ts
- Create note API: src/app/api/modules/guild-grimoire/notes/route.ts
- Delete note API: src/app/api/modules/guild-grimoire/notes/[id]/route.ts
- Tags API: src/app/api/modules/guild-grimoire/tags/route.ts
- Summary API: src/app/api/modules/guild-grimoire/summary/route.ts
- Registry entry: modules/registry.json

Notes
- Module requires auth for posting and feed access.
- Data is backed by `guild_grimoire_notes`, `guild_grimoire_tags`, and `guild_grimoire_note_tags`.
- Supports text, image, or audio per note (single content mode per post).
