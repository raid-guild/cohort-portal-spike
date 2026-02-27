"use client";

import { FormEvent, useState } from "react";

export function CohortLandingReferralForm({
  cohortId,
  cohortName,
}: {
  cohortId: string;
  cohortName: string;
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/email-referrals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          referral: `cohort-landing:${cohortId}:${cohortName}`,
        }),
      });

      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to submit referral.");
      }

      setEmail("");
      setMessage("Thanks, you are on the list.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit referral.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} aria-busy={saving} className="space-y-2 rounded-lg border border-border p-4">
      <p className="text-sm font-medium">Apply for this cohort</p>
      <p className="text-xs text-muted-foreground">
        Leave your email and we will share next steps.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
          placeholder="you@example.com"
        />
        <button
          type="submit"
          disabled={saving}
          aria-busy={saving}
          className="rounded border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-60"
        >
          {saving ? "Submitting..." : "Sign up"}
        </button>
      </div>
      {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </form>
  );
}
