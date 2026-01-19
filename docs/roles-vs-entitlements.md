# Roles vs Entitlements

This portal uses two different mechanisms for access control: roles and entitlements.
They solve different problems and should be used together.

## Roles (who you are)
Use roles for app-level permissions such as staff actions and moderation.

Examples:
- `host` can publish announcements and approve applicants.
- `admin` can manage system settings.

Roles are typically:
- long-lived
- assigned manually by staff
- not tied to payments

Code references:
- Roles are read from `public.user_roles`.
- Example API usage: `GET /api/me/roles`.

## Entitlements (what you can access)
Use entitlements for cohort participation, paid access, and approvals.

Examples:
- `cohort-approved` lets a user see the Billing module.
- `cohort-access` unlocks paid modules and cohort tools.

Entitlements are typically:
- granted by workflows (approval, payment, crypto, etc.)
- time-bound (via `expires_at`)
- enforced in UI gating and APIs

Code references:
- Entitlements are read from `public.entitlements`.
- Example API usage: `GET /api/me/entitlements`.
- UI gating: `src/components/ModuleSurfaceList.tsx` checks `access.entitlement`.

## Recommended Cohort Flow
1) User signs in and creates a profile.
2) User applies to a cohort (future module).
3) Host approves the applicant -> set `cohort-approved` entitlement.
4) Billing module is visible when `cohort-approved` is active.
5) Payment creates `cohort-access` entitlement (Stripe or crypto).

Hosts who need participant visibility can also be granted `cohort-approved` and
`cohort-access` entitlements to keep gating consistent across modules.

In this repo, `scripts/make-host.js` grants both the `host` role and those
entitlements to keep host access aligned with participant gating.

## Example: Gate Billing Module by Approval Entitlement
`modules/registry.json`:
```json
{
  "id": "billing",
  "access": {
    "requiresAuth": true,
    "entitlement": "cohort-approved"
  }
}
```

## Example: Grant Entitlement on Approval
`POST /api/admin/approve-applicant` (pseudo):
```ts
await admin.from("entitlements").upsert({
  user_id: applicantId,
  entitlement: "cohort-approved",
  status: "active"
});
```

## Example: Grant Entitlement on Payment
`src/app/api/stripe/webhook/route.ts` (current behavior):
```ts
await upsertEntitlement(userId, "active", { source: "stripe" });
```
