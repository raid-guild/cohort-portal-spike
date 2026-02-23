"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type DaoMemberSnapshot = {
  id: string;
  dao_id: string;
  chain_id: string;
  shares: string;
  loot: string;
  voting_power: string;
  wallet_address: string;
  last_synced_at: string;
};

type DaoMemberOverview = {
  memberships: DaoMemberSnapshot[];
  totals: {
    activeMemberships: number;
    shares: string;
    loot: string;
    votingPower: string;
  };
  lastSyncedAt: string | null;
  error?: string;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function DaoMemberDashboard() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<DaoMemberOverview | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token ?? null);
    });
    return () => {
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!token) {
        if (!cancelled) {
          setOverview(null);
          setLoading(false);
          setMessage("Sign in to view the DAO member dashboard.");
        }
        return;
      }

      setLoading(true);
      setMessage("");
      try {
        const res = await fetch("/api/modules/dao-member-dashboard/overview", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const json = (await res.json().catch(() => null)) as DaoMemberOverview | null;
        if (!res.ok) {
          if (!cancelled) {
            setOverview(null);
            setMessage(json?.error ?? "Unable to load DAO member dashboard.");
          }
          return;
        }
        if (!cancelled) {
          setOverview(json);
          setMessage("");
        }
      } catch {
        if (!cancelled) {
          setOverview(null);
          setMessage("Unable to load DAO member dashboard.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading member dashboard...</p>;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">DAO Member Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Track your DAO shares, loot, and voting power across active memberships.
        </p>
      </header>

      {message ? (
        <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          {message}
        </div>
      ) : null}

      {overview ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Active memberships" value={String(overview.totals.activeMemberships)} />
            <MetricCard label="Voting power" value={overview.totals.votingPower} />
            <MetricCard label="Shares" value={overview.totals.shares} />
            <MetricCard label="Loot" value={overview.totals.loot} />
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Memberships</h2>
              <p className="text-xs text-muted-foreground">
                Last synced: {formatDate(overview.lastSyncedAt)}
              </p>
            </div>

            {overview.memberships.length ? (
              <div className="space-y-3">
                {overview.memberships.map((membership) => (
                  <article
                    key={membership.id}
                    className="rounded-lg border border-border bg-background p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">
                        {membership.dao_id} <span className="text-muted-foreground">({membership.chain_id})</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Synced {formatDate(membership.last_synced_at)}
                      </p>
                    </div>
                    <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                      <p>Voting power: {membership.voting_power}</p>
                      <p>Shares: {membership.shares}</p>
                      <p>Loot: {membership.loot}</p>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Wallet: {membership.wallet_address}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No active memberships linked to your account yet.
              </p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
