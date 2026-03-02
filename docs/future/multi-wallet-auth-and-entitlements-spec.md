# Multi-Wallet Auth and Entitlements Spec (Future)

## Status
- Proposed
- Not implemented as of March 2, 2026

## Context
Current portal behavior is effectively single-wallet:
- Profile stores one `wallet_address`.
- DAO claim checks the wallet from current auth identity.
- Entitlement sync metadata stores one wallet address.

This creates limitations for users who operate multiple wallets and need:
- login continuity across wallets,
- primary wallet management,
- entitlement claiming from any verified wallet they control.

## Goals
- Support many wallet addresses per user profile.
- Allow users to add, remove, and set a primary wallet.
- Prevent account lockout when removing wallets.
- Make DAO claim and related entitlement checks work across all linked wallets.
- Keep backward compatibility with existing profile and module flows.

## Non-Goals
- Replacing Supabase auth provider behavior.
- Supporting unverified wallet links.
- Building chain-specific portfolio features in this phase.

## Constraints
- Supabase Web3 identity linking via `linkIdentity` is currently not available in this repo workflow.
- Wallet ownership must therefore be verified by app-managed signature challenge before linking.

## Product Rules

### 1) Minimum login safety
- A user must always retain at least one login path.
- Removing a wallet is blocked when:
  - it is the last linked wallet, and
  - no confirmed email login exists.
- Error copy: `Link an email before removing your last wallet.`

### 2) Add wallet flow
- User starts "Add wallet".
- Server issues nonce/challenge.
- User signs challenge with wallet.
- Server verifies signature and links wallet as `verified`.
- Duplicate addresses are rejected globally (a wallet can belong to only one user).

### 3) Primary wallet
- Exactly one primary wallet per user when at least one wallet exists.
- User can manually set primary.
- If primary is removed and another wallet exists, system auto-promotes one deterministic fallback (most recently verified).

### 4) Entitlements and DAO claim behavior
- DAO claim checks membership records against any verified linked wallet for the user.
- `dao-member` entitlement remains user-scoped (`user_id + entitlement`).
- Entitlement metadata may include the wallet used for the successful claim.

## Data Model

### New table: `public.user_wallets`
Suggested columns:
- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `chain text not null` (`ethereum` for v1; allow extension)
- `address text not null` (normalized lowercase for EVM)
- `is_primary boolean not null default false`
- `verified_at timestamptz not null default now()`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Suggested constraints and indexes:
- unique `(chain, address)` to prevent multi-account reuse
- partial unique index on `(user_id)` where `is_primary = true`
- index on `(user_id, chain)`

RLS policy direction:
- Select/insert/update/delete allowed only for row owner (`auth.uid() = user_id`)
- Service role retains full access for server workflows

## Backward Compatibility
- Keep `profiles.wallet_address` in place initially.
- Treat `profiles.wallet_address` as a denormalized primary wallet field.
- On wallet changes, sync `profiles.wallet_address` to current primary (or null if none).
- Existing UI that reads `wallet_address` continues to work during migration.

## API Surface (Proposed)

### `GET /api/me/wallets`
Returns linked wallets sorted with primary first.

### `POST /api/me/wallets/challenge`
Creates short-lived nonce for add-wallet verification.

### `POST /api/me/wallets`
Verifies signature and links wallet.
Optional flag to set as primary.

### `POST /api/me/wallets/:id/primary`
Sets selected wallet as primary.

### `DELETE /api/me/wallets/:id`
Removes wallet, enforcing minimum-login safety rule.

## UI/UX (Profile / Me Page)
- Add "Wallets" management card.
- Display:
  - wallet list (chain, truncated address, primary badge, verified date),
  - "Set primary" action for non-primary wallets,
  - "Remove" action.
- "Add wallet" flow opens signature prompt.
- If user has no email linked, show warning before allowing removal actions.

## DAO and Entitlement Updates

### DAO claim endpoint changes
- Replace single-wallet lookup with:
  - load all verified wallets for user,
  - query `dao_memberships` where `wallet_address` is in linked wallet set.
- If multiple active memberships match, keep explicit DAO/chain selection requirement.

### Summary endpoints
- DAO summary should report:
  - number of linked wallets,
  - primary wallet,
  - memberships matched across all wallets.

## Security and Abuse Controls
- Use per-user nonce with short expiration for add-wallet signature flow.
- Nonce must be one-time use.
- Normalize/validate addresses before storage and comparison.
- Audit-log wallet add/remove/primary changes (future enhancement if audit table exists).

## Migration Plan (Phased)

### Phase 1: Schema + read path
- Add `user_wallets` table and constraints.
- Backfill from `profiles.wallet_address` into `user_wallets` as primary where possible.
- Keep existing behavior unchanged for auth and claim.

### Phase 2: Wallet management APIs + UI
- Implement add/remove/set-primary endpoints.
- Add `/me` wallet management UI.
- Keep `profiles.wallet_address` synchronized with primary wallet.

### Phase 3: DAO claim and entitlement integration
- Update DAO claim and summary routes to use all linked wallets.
- Update entitlement metadata to include `source_wallet`.

### Phase 4: Cleanup (optional)
- Decide whether `profiles.wallet_address` remains denormalized forever or is deprecated.

## Open Questions
- Should we support Solana wallet linking in v1 of management or Ethereum-only first?
- Should users be allowed to mark unverified wallets as "watch-only" (likely no)?
- Do we need host/admin tools for wallet conflict resolution?
- Should removing a wallet immediately revoke wallet-derived entitlements, or only at next sync?

## Acceptance Criteria for Implementation PR
- User can link multiple verified wallets.
- User can set exactly one primary wallet.
- User cannot remove last wallet without linked email.
- DAO claim works from any linked verified wallet.
- Existing profile pages continue to render wallet info without regression.
