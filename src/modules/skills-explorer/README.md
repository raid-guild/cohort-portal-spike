# Skills Explorer Module

Purpose
- Visualize cohort skills and roles.
- Provide a graph and top-skill summary for the people directory.

Key files
- Page: src/app/modules/skills-explorer/page.tsx
- Module UI: src/modules/skills-explorer/SkillsExplorer.tsx
- Graph: src/modules/skills-explorer/SkillsGraph.tsx
- Summary API: src/app/api/modules/skills-explorer/summary/route.ts
- Profile summary API: src/app/api/modules/skills-explorer/summary/profile/route.ts

Notes
- Data is sourced from Supabase profiles via src/lib/people.ts.
- The graph is client-side using @react-three/fiber.
