# Staging seeds

Put staging-only, idempotent seed SQL files here.

Guidelines:
- Idempotent: safe to run multiple times (deterministic IDs + upserts).
- Staging-only: do **not** run these against production.

Suggested structure:
- `0001_personas.sql` — test user role/entitlement bindings (for pre-created auth users)
- `0002_<module>_fixtures.sql` — minimal data to exercise module flows
