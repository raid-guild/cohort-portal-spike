# Third-Party Data Access (Notes)

This note sketches a future model for third-party modules that want to access
portal data. It focuses on explicit scopes, clear public/private boundaries, and
server-side enforcement.

## Data Classes
- `public`: safe for unauthenticated access (directory/profile public fields).
- `authenticated`: requires a signed-in user (member-only data).
- `private`: only the owning user can access.
- `admin`: host/admin only.

## Module Scopes (Registry Capabilities)
Declare allowed scopes in `modules/registry.json` under `capabilities`.

Examples:
```json
{
  "capabilities": {
    "profiles": { "read": ["public", "authenticated"] },
    "cohorts": { "read": ["authenticated"] },
    "moduleData": { "read": true, "write": true },
    "profileWrite": { "fields": ["bio", "links"], "requiresUserAuth": true }
  }
}
```

## Auth Models
1) Module Key (server-to-server)
- Module key grants access to module-owned data and any explicitly permitted
  public/authenticated reads.
- Used for backend services or cron jobs.

2) User Auth (delegated)
- Endpoints accept `Authorization: Bearer <access_token>`.
- Access is restricted to the signed-in user’s data and visibility rules.

3) Module + User (sensitive actions)
- Require both module key and user auth for high-risk actions (writes to shared
  tables, profile mutations, cohort applications, etc).

## Example Endpoints (Conceptual)
- `GET /api/profiles?scope=public`
  - Public fields only.
- `GET /api/profiles/me`
  - Authenticated user profile.
- `GET /api/cohorts`
  - Auth + entitlement gating for cohort access.
- `POST /api/module-data`
  - Requires module key; writes only under the module’s id.

## Enforcement Rules
- Visibility enforced server-side for every endpoint.
- Capabilities should be validated against the registry before fulfilling a request.
- Future: issue scoped module tokens if module keys need rotation or revocation.

## Next Steps
- Add a small capabilities schema and validation.
- Define a public profile read model and a minimal authenticated profile model.
- Decide if module keys alone can read authenticated data or if user auth is required.
