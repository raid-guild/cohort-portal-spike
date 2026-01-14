# Profile Generators Module

Purpose
- Generate display names and avatars for the signed-in user.
- Combine AI generation and profile writes under a single module contract.

Key files
- Module page: src/app/modules/profile-generators/page.tsx
- Display name UI: src/modules/profile-generators/DisplayNameGenerator.tsx
- Avatar UI: src/modules/profile-generators/AvatarGenerator.tsx
- Name API: src/app/api/modules/profile-generators/generate-name/route.ts
- Avatar API: src/app/api/modules/profile-generators/generate-avatar/route.ts
- Summary API: src/app/api/modules/profile-generators/summary/route.ts
- Registry entry: modules/registry.json

Notes
- Uses Venice AI (chat for names, image generation for avatars).
- Updates profile via the portal-owned profile write API and storage uploads.
