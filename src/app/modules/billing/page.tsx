"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";

export default function BillingPage() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [entitlements, setEntitlements] = useState<string[]>([]);
  const [entitlementDetails, setEntitlementDetails] = useState<
    { entitlement: string; status: string; metadata?: unknown; expires_at?: string | null }[]
  >([]);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [startingCrypto, setStartingCrypto] = useState(false);

  const loadEntitlements = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setEntitlements([]);
      setEntitlementDetails([]);
      setAuthToken(null);
      return;
    }
    setAuthToken(data.session.access_token);
    const res = await fetch("/api/me/entitlements", {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });
    const json = await res.json().catch(() => ({}));
    setEntitlements(json.entitlements ?? []);
    setEntitlementDetails(json.records ?? []);
  };

  useEffect(() => {
    let cancelled = false;
    const loadWithCancel = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (!cancelled) {
          setEntitlements([]);
          setEntitlementDetails([]);
          setAuthToken(null);
        }
        return;
      }
      setAuthToken(data.session.access_token);
      const res = await fetch("/api/me/entitlements", {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!cancelled) {
        setEntitlements(json.entitlements ?? []);
        setEntitlementDetails(json.records ?? []);
      }
    };
    loadWithCancel();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      loadWithCancel();
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  const hasCohortAccess = entitlements.includes("cohort-access");
  const isApproved = entitlements.includes("cohort-approved");
  const canStartCheckout = !hasCohortAccess && Boolean(authToken);
  const cohortRecord = entitlementDetails.find(
    (record) => record.entitlement === "cohort-access",
  );
  const cohortMetadata =
    cohortRecord?.metadata && typeof cohortRecord.metadata === "object"
      ? (cohortRecord.metadata as Record<string, unknown>)
      : null;
  const cancelsAtPeriodEnd = Boolean(cohortMetadata?.cancel_at_period_end);
  const cancelAt =
    typeof cohortMetadata?.cancel_at === "number"
      ? new Date(cohortMetadata.cancel_at * 1000)
      : null;
  const currentPeriodEnd =
    typeof cohortMetadata?.current_period_end === "number"
      ? new Date(cohortMetadata.current_period_end * 1000)
      : null;
  const endDate = cancelAt ?? currentPeriodEnd;
  const showsEndingNotice = Boolean(cancelAt) || cancelsAtPeriodEnd;
  const entitlementExpiresAt =
    typeof cohortRecord?.expires_at === "string"
      ? new Date(cohortRecord.expires_at)
      : null;
  const entitlementSource =
    typeof cohortMetadata?.source === "string" ? cohortMetadata.source : null;

  const startCheckout = async () => {
    if (!authToken) {
      setActionError("Sign in to start a subscription.");
      return;
    }
    setActionError(null);
    setStartingCheckout(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error ?? "Unable to start checkout.");
      }
      if (json.url) {
        window.location.assign(json.url);
        return;
      }
      throw new Error("Missing checkout URL.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Checkout failed.";
      setActionError(message);
    } finally {
      setStartingCheckout(false);
    }
  };

  const openPortal = async () => {
    if (!authToken) {
      setActionError("Sign in to manage billing.");
      return;
    }
    setActionError(null);
    setOpeningPortal(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error ?? "Unable to open billing portal.");
      }
      if (json.url) {
        window.location.assign(json.url);
        return;
      }
      throw new Error("Missing billing portal URL.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Portal failed.";
      setActionError(message);
    } finally {
      setOpeningPortal(false);
    }
  };

  const startCryptoMock = async () => {
    if (!authToken) {
      setActionError("Sign in to try the crypto flow.");
      return;
    }
    setActionError(null);
    setStartingCrypto(true);
    try {
      const res = await fetch("/api/billing/crypto/mock", {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error ?? "Unable to start crypto access.");
      }
      await loadEntitlements();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Crypto flow failed.";
      setActionError(message);
    } finally {
      setStartingCrypto(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Your Cohort Commitment</h1>
        <p className="text-sm text-muted-foreground">
          Stake into becoming a Raider while you build with us. Approval unlocks
          billing, payment unlocks access.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">Cohort access</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Status: {hasCohortAccess ? "Active" : "Inactive"}
            </div>
            {hasCohortAccess && entitlementSource ? (
              <div className="mt-1 text-xs text-muted-foreground">
                Active via {entitlementSource}
              </div>
            ) : null}
            {hasCohortAccess && showsEndingNotice ? (
              <div className="mt-1 text-xs text-muted-foreground">
                {endDate
                  ? `Ends on ${endDate.toLocaleDateString()}`
                  : "Cancels at period end"}
              </div>
            ) : null}
            {hasCohortAccess && entitlementExpiresAt ? (
              <div className="mt-1 text-xs text-muted-foreground">
                Access ends on {entitlementExpiresAt.toLocaleDateString()}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-lg border border-border px-4 py-2 text-xs ${
                hasCohortAccess
                  ? "bg-primary text-background hover:opacity-90"
                  : "hover:bg-muted"
              }`}
              disabled={!authToken || openingPortal}
              onClick={openPortal}
            >
              {openingPortal ? "Opening..." : "Manage billing"}
            </button>
            <button
              type="button"
              className="rounded-lg border border-border px-4 py-2 text-xs hover:bg-muted"
              disabled={!authToken}
              onClick={loadEntitlements}
            >
              Refresh status
            </button>
          </div>
        </div>
        {actionError ? (
          <p className="mt-3 text-xs text-red-500">{actionError}</p>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Leave anytime. Crypto payments include partial refunds.
          </p>
        )}
      </section>

      {!isApproved ? (
        <section className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <div className="text-sm font-semibold text-foreground">
            Approval required
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Billing unlocks after your cohort application is approved. Payment
            comes after approval and unlocks cohort access. If you haven’t
            applied yet, submit your application to get started.
          </p>
          <div className="mt-4">
            <a
              href="/modules/cohort-application"
              className="rounded-lg border border-border px-4 py-2 text-xs hover:bg-muted"
            >
              Apply to the cohort
            </a>
          </div>
        </section>
      ) : (
        <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <div className="text-sm font-semibold text-foreground">Summary</div>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span>Monthly contribution</span>
              <span className="font-semibold text-foreground">$100</span>
            </div>
            <div className="flex items-center justify-between">
              <span>To membership escrow</span>
              <span className="font-semibold text-foreground">$75</span>
            </div>
            <div className="flex items-center justify-between">
              <span>To cohort operations</span>
              <span className="font-semibold text-foreground">$25</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Commitment window</span>
              <span className="font-semibold text-foreground">6 months</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <div className="text-sm font-semibold text-foreground">What this unlocks</div>
          <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
            <li>Full cohort access</li>
            <li>Projects, mentors, and Demo Day</li>
            <li>Your profile, badges, and progress</li>
            <li>A path to RaidGuild membership</li>
          </ul>
        </div>
      </section>
      )}

      {isApproved ? (
        <section className="space-y-3">
        <div className="text-sm font-semibold text-foreground">Payment options</div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            <div className="text-sm font-semibold text-foreground">Credit card</div>
            <p className="mt-2 text-xs text-muted-foreground">
              Secure checkout with Stripe. Leave anytime.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className={`rounded-lg border border-border px-4 py-2 text-xs ${
                  hasCohortAccess
                    ? "bg-muted text-muted-foreground"
                    : "bg-primary text-background hover:opacity-90"
                }`}
                disabled={!canStartCheckout || startingCheckout}
                onClick={startCheckout}
              >
                {startingCheckout
                  ? "Starting..."
                  : hasCohortAccess
                    ? "Commitment active"
                    : "Start My Cohort Commitment"}
              </button>
              <button
                type="button"
                className="rounded-lg border border-border px-4 py-2 text-xs hover:bg-muted"
                disabled={!authToken || openingPortal}
                onClick={openPortal}
              >
                {openingPortal ? "Opening..." : "Manage billing"}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
            <div className="text-sm font-semibold text-foreground">USDC</div>
            <p className="mt-2 text-xs text-muted-foreground">
              5% discount + early exit refunds. On-chain flow coming soon.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg border border-border px-4 py-2 text-xs hover:bg-muted"
                disabled={!authToken || startingCrypto}
                onClick={startCryptoMock}
              >
                {startingCrypto ? "Processing..." : "Simulate USDC payment"}
              </button>
            </div>
          </div>
        </div>
      </section>
      ) : null}

      <details className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">
          How this works
        </summary>
        <div className="mt-4 space-y-4 text-sm text-muted-foreground">
          <div>
            <div className="text-sm font-semibold text-foreground">What am I paying for?</div>
            <p className="mt-2">
              You’re not paying for content. You’re staking into becoming a Raider.
              Most of what you pay is set aside as your membership escrow. The rest
              funds the people and systems running the cohort.
            </p>
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">
              How does my escrow apply to membership?
            </div>
            <p className="mt-2">
              Your escrow can be applied to up to the full RaidGuild membership due,
              which is currently $500. If your escrow reaches or exceeds that amount,
              $500 is applied to your membership and any additional escrow becomes a
              cohort contribution.
            </p>
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">
              What happens after I become a member?
            </div>
            <p className="mt-2">
              Once you graduate a cohort, participate in a RIP or RAID, and are
              championed by an existing member, your cohort commitment ends. From
              that point forward, you are a full RaidGuild member and no longer pay
              the $100/month.
            </p>
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">What if I leave early?</div>
            <p className="mt-2">
              If you pay with USDC, you can exit early and receive 25% of your escrow
              back. The rest is forfeited to the guild.
            </p>
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">
              What if I don’t become a member?
            </div>
            <p className="mt-2">
              If you don’t meet the membership requirements, your escrow remains
              with the guild. You still received full cohort access and keep your
              profile, badges, and proof of work. You didn’t buy membership — you
              staked to try.
            </p>
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">Is this a bootcamp?</div>
            <p className="mt-2">
              No. This is the front door to a guild. You’re joining a group of
              builders who ship together, earn trust, and become members over time.
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}
