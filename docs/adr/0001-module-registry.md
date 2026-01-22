# ADR 0001: Registry-Driven Module Discovery

## Status
Accepted

## Context
The portal is intended to be a directory-first experience where profiles are core and
everything else ships as modules. Multiple teams need to add, update, and surface
modules without editing core page code. Modules may be internal pages or external
links/embeds and need consistent treatment (summaries, access gating, and surfaces).

## Decision
Use `modules/registry.json` as the source of truth for module discovery and surface
composition. Pages use tags and metadata from the registry to render module cards,
summaries, and access gating consistently across the portal.

## Consequences
### Positive
- Non-core teams can add modules without touching UI logic.
- Surfaces (home/people/profile/me) are curated by tags, not hardcoded lists.
- External modules and internal pages are treated uniformly.
- Registry metadata centralizes access rules and summary configuration.

### Negative
- Requires ongoing discipline to keep registry entries accurate.
- Adds a layer of indirection that can drift from actual implementation.

## Alternatives Considered
1. Hardcode modules per page.
   - Simpler for small, static apps but scales poorly with multiple owners.
2. Store module definitions only in the database.
   - Adds operational overhead and introduces runtime dependency for rendering.
3. Use static imports + config per surface.
   - Reduces flexibility and still duplicates metadata across pages.

## Notes
If the portal becomes a fixed set of internal pages, the registry can be removed in
favor of direct imports and route links. Until then, the registry provides lightweight
governance and a clear extension point for module owners.

## References
- `modules/registry.json`
- `docs/module-authoring.md`
- `docs/architecture.md`
