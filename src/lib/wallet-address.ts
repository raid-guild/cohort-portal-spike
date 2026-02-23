import type { User } from "@supabase/supabase-js";

export function getWalletFromUser(user: User | null) {
  if (!user) return null;
  const meta = user.user_metadata as
    | {
        wallet_address?: string;
        address?: string;
        walletAddress?: string;
        custom_claims?: { address?: string };
      }
    | undefined;
  const metaAddress = extractWalletFromIdentity(meta);
  if (metaAddress) return metaAddress;

  const identities = user.identities ?? [];
  for (const identity of identities) {
    const data = identity?.identity_data as
      | {
          wallet_address?: string;
          address?: string;
          walletAddress?: string;
          custom_claims?: { address?: string };
        }
      | undefined;
    const identityAddress = extractWalletFromIdentity(data);
    if (identityAddress) return identityAddress;
  }
  return null;
}

export function normalizeWalletAddress(value?: string | null) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

function extractWalletFromIdentity(
  value?:
    | {
        wallet_address?: string;
        address?: string;
        walletAddress?: string;
        custom_claims?: { address?: string };
      }
    | null,
) {
  if (!value) return null;
  if (value.wallet_address) return normalizeWalletAddress(value.wallet_address);
  if (value.walletAddress) return normalizeWalletAddress(value.walletAddress);
  if (value.address) return normalizeWalletAddress(value.address);
  if (value.custom_claims?.address) {
    return normalizeWalletAddress(value.custom_claims.address);
  }
  return null;
}
