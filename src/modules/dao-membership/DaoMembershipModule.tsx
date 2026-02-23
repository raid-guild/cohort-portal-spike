"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type DaoMembershipCandidate = {
  id: string;
  dao_id: string;
  chain_id: string;
  wallet_address: string;
  status: string;
  shares: string | number;
  loot: string | number;
  voting_power: string | number;
};

type DaoClaimCandidateResponse = {
  walletAddress?: string;
  activeMemberships?: DaoMembershipCandidate[];
  unclaimedProfile?: { handle: string; display_name?: string | null; user_id?: string | null } | null;
  ownedProfile?: { handle: string; display_name?: string | null; user_id?: string | null } | null;
  error?: string;
};

export function DaoMembershipModule() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDaoMembership, setSelectedDaoMembership] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [claimData, setClaimData] = useState<DaoClaimCandidateResponse | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthToken(data.session?.access_token ?? null);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthToken(session?.access_token ?? null);
      setLoading(false);
    });
    return () => {
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  const loadClaimCandidate = useCallback(async () => {
    if (!authToken) {
      setClaimData(null);
      setSelectedDaoMembership("");
      return;
    }

    const res = await fetch("/api/dao/claim", {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const json = (await res.json().catch(() => ({}))) as DaoClaimCandidateResponse;
    if (!res.ok) {
      setClaimData({ error: json.error ?? "Unable to load DAO membership." });
      setSelectedDaoMembership("");
      return;
    }
    setClaimData(json);
    const active = json.activeMemberships ?? [];
    if (active.length === 1) {
      setSelectedDaoMembership(`${active[0].dao_id}::${active[0].chain_id}`);
    }
  }, [authToken]);

  useEffect(() => {
    loadClaimCandidate().catch(() => {
      setClaimData({ error: "Unable to load DAO membership." });
    });
  }, [loadClaimCandidate]);

  const handleClaim = async () => {
    if (!authToken) {
      setMessage("Sign in with your wallet first.");
      return;
    }
    const [daoId, chainId] = selectedDaoMembership.split("::");
    if (!daoId || !chainId) {
      setMessage("Select which membership to claim.");
      return;
    }

    setSubmitting(true);
    setMessage("");
    try {
      const res = await fetch("/api/dao/claim", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ daoId, chainId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(json.error ?? "Unable to claim membership.");
        return;
      }
      setMessage(
        json.claimedProfileHandle
          ? `Profile claimed: @${json.claimedProfileHandle}.`
          : "DAO membership claimed.",
      );
      await loadClaimCandidate();
      window.localStorage.setItem("profile-updated", new Date().toISOString());
      window.postMessage({ type: "profile-updated" }, window.location.origin);
    } catch {
      setMessage("Unable to claim membership.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (!authToken) {
    return (
      <p className="text-sm text-muted-foreground">
        Sign in with your wallet to claim DAO membership.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">DAO Membership</h1>
        <p className="text-sm text-muted-foreground">
          Claim your imported DAO membership profile with your wallet-auth session.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        {claimData?.error ? (
          <p className="text-sm text-muted-foreground">{claimData.error}</p>
        ) : (
          <>
            <div className="text-xs text-muted-foreground">
              Wallet: {claimData?.walletAddress ?? "Not detected"}
            </div>
            {(claimData?.activeMemberships ?? []).length ? (
              <div className="space-y-3">
                <label className="text-xs text-muted-foreground block">
                  Active memberships
                </label>
                <select
                  value={selectedDaoMembership}
                  onChange={(event) => setSelectedDaoMembership(event.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs"
                >
                  <option value="">Select membership</option>
                  {(claimData?.activeMemberships ?? []).map((row) => (
                    <option key={row.id} value={`${row.dao_id}::${row.chain_id}`}>
                      {row.dao_id} on {row.chain_id} · voting power {String(row.voting_power)}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-muted-foreground">
                  {claimData?.ownedProfile
                    ? `Already linked to profile @${claimData.ownedProfile.handle}.`
                    : claimData?.unclaimedProfile
                      ? `Unclaimed imported profile found: @${claimData.unclaimedProfile.handle}.`
                      : "No imported profile row found; claim still links membership and entitlement."}
                </div>
                <button
                  type="button"
                  onClick={handleClaim}
                  disabled={submitting || !selectedDaoMembership}
                  className="rounded-lg border border-border bg-primary px-3 py-2 text-xs text-background hover:opacity-90 disabled:opacity-60"
                >
                  {submitting ? "Claiming..." : "Claim profile"}
                </button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No active DAO membership found for this wallet.
              </p>
            )}
          </>
        )}
        {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      </section>
    </div>
  );
}
