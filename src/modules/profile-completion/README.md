# Profile Completion Module

Purpose
- Provide a summary-only module that shows profile completion progress.
- Render on profile and /me surfaces via registry summaries.

Key files
- Summary API: src/app/api/modules/profile-completion/summary/route.ts
- Summary config: modules/registry.json
- Summary renderer: src/components/ModuleSummary.tsx

Notes
- This module does not have a standalone page.
- Progress bar rendering is enabled via summary `progressKey`.
