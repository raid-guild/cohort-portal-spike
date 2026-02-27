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
      const apiKey = process.env.NEXT_PUBLIC_FORM_API_KEY;
      if (!apiKey) {
        throw new Error("Referral form is not configured for this environment.");
      }

      const res = await fetch("/api/email-referrals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-form-api-key": apiKey,
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
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-xl border-2 border-foreground/20 bg-card p-5 shadow-sm"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Join This Cohort
      </p>
      <p className="text-xl font-semibold leading-tight text-foreground">
        Apply now and get cohort updates
      </p>
      <p className="text-sm text-muted-foreground">
        Leave your email and we will share next steps.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
          className="whitespace-nowrap rounded bg-foreground px-5 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Submitting..." : "Sign up"}
        </button>
      </div>
      {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </form>
  );
}
