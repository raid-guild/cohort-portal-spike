# Module Registry

Modules are registered in `modules/registry.json`. This is the only file the portal needs to discover and render modules.

## Module Types
1. `link` - Link out to a module URL.
2. `embed` - Render in an iframe; provide `embed.height`.

## Adding a Module
1. Add an entry to `modules/registry.json`.
2. Provide module metadata: `id`, `title`, `description`, `lane`, `type`, `url`, `status`, `tags`.

## Summary-only Modules
If you only want a card with a summary (no CTA), set:
- `presentation.action: "none"`, or
- omit `url` entirely (the portal will hide the action button).

## Host-only Modules
Add the `hosts` tag to hide a module from non-hosts. Roles are managed in `public.user_roles`.
