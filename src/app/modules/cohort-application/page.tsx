"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type ApplicationRecord = {
  id: string;
  status: string;
  signal_check_status: string;
  intent: string;
  goals: string;
  time_commitment: string;
  work_interest: string;
  past_work?: string | null;
  applied_at: string;
};

type HostApplication = ApplicationRecord & {
  user_id: string;
};

export default function CohortApplicationPage() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [application, setApplication] = useState<ApplicationRecord | null>(null);
  const [hostApplications, setHostApplications] = useState<HostApplication[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [intent, setIntent] = useState("");
  const [goals, setGoals] = useState("");
  const [timeCommitment, setTimeCommitment] = useState("");
  const [workInterest, setWorkInterest] = useState("");
  const [pastWork, setPastWork] = useState("");

  const loadApplication = async (token: string) => {
    const res = await fetch("/api/cohort-applications", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json().catch(() => ({}));
    setApplication(json.application ?? null);
  };

  const loadHostApplications = async (token: string) => {
    const res = await fetch("/api/cohort-applications/host", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json().catch(() => ({}));
    setHostApplications(json.applications ?? []);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      setAuthToken(session?.access_token ?? null);
      if (!session?.access_token) {
        setLoading(false);
        return;
      }
      Promise.all([
        loadApplication(session.access_token),
        fetch("/api/me/roles", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
          .then((res) => res.json())
          .then((json) => {
            const roles = json.roles ?? [];
            setIsHost(roles.includes("host"));
          })
          .catch(() => setIsHost(false)),
      ]).finally(() => setLoading(false));
    });
  }, [supabase]);

  useEffect(() => {
    if (authToken && isHost) {
      loadHostApplications(authToken);
    }
  }, [authToken, isHost]);

  const handleSubmit = async () => {
    if (!authToken) {
      setMessage("Sign in to apply.");
      return;
    }
    if (!intent || !goals || !timeCommitment || !workInterest) {
      setMessage("Please fill out all required fields.");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/cohort-applications", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent,
          goals,
          timeCommitment,
          workInterest,
          pastWork,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error ?? "Unable to submit application.");
      }
      setApplication(json.application);
      setMessage("Application submitted.");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Submission failed.";
      setMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleHostDecision = async (id: string, action: "approve" | "reject") => {
    if (!authToken) return;
    const res = await fetch(`/api/cohort-applications/${id}/${action}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setHostApplications((prev) =>
        prev.map((item) => (item.id === id ? json.application : item)),
      );
    } else {
      setMessage(json.error ?? "Unable to update application.");
    }
  };

  const formatDate = (value?: string) => {
    if (!value) return "—";
    return new Date(value).toLocaleDateString();
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Cohort Application</h1>
        <p className="text-sm text-muted-foreground">
          Apply to join the cohort. If accepted, you’ll choose a commitment path
          before payment.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : !authToken ? (
        <p className="text-sm text-muted-foreground">
          Sign in to submit an application.
        </p>
      ) : null}

      {application ? (
        <section className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <div className="text-sm font-semibold text-foreground">Your application</div>
          <div className="mt-2 inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            Submitted
          </div>
          <div className="mt-3 grid gap-3 text-xs">
            <div>
              <div className="font-semibold text-foreground">Status</div>
              <div className="mt-1 text-muted-foreground">{application.status}</div>
            </div>
            <div>
              <div className="font-semibold text-foreground">Signal check</div>
              <div className="mt-1 text-muted-foreground">
                {application.signal_check_status}
              </div>
            </div>
            <div>
              <div className="font-semibold text-foreground">Applied</div>
              <div className="mt-1 text-muted-foreground">
                {formatDate(application.applied_at)}
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Applications can’t be edited after submission. If we need more info,
            we’ll reach out directly.
          </p>
        </section>
      ) : (
        <section className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <div className="text-sm font-semibold text-foreground">Application</div>
          <div className="mt-4 grid gap-4">
            <label className="text-xs text-muted-foreground">
              Why do you want to join this cohort now?
              <textarea
                value={intent}
                onChange={(event) => setIntent(event.target.value)}
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                rows={4}
              />
            </label>
            <label className="text-xs text-muted-foreground">
              What do you hope to get out of it?
              <textarea
                value={goals}
                onChange={(event) => setGoals(event.target.value)}
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                rows={3}
              />
            </label>
            <label className="text-xs text-muted-foreground">
              How much time can you commit per week?
              <input
                value={timeCommitment}
                onChange={(event) => setTimeCommitment(event.target.value)}
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                placeholder="Example: 6-8 hours/week"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              What kind of work do you want to do?
              <input
                value={workInterest}
                onChange={(event) => setWorkInterest(event.target.value)}
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                placeholder="Dev, design, ops, research, exploratory"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Examples of past work (optional)
              <textarea
                value={pastWork}
                onChange={(event) => setPastWork(event.target.value)}
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                rows={3}
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="rounded-lg border border-border bg-primary px-4 py-2 text-xs text-background hover:opacity-90"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit application"}
            </button>
            {message ? (
              <span className="text-xs text-muted-foreground">{message}</span>
            ) : null}
          </div>
        </section>
      )}

      {message && application ? (
        <p className="text-xs text-muted-foreground">{message}</p>
      ) : null}

      {isHost ? (
        <section className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <div className="text-sm font-semibold text-foreground">Host review</div>
          <div className="mt-4 space-y-4">
            {hostApplications.length ? (
              hostApplications.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-border bg-background p-4 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-foreground">
                      {item.user_id}
                    </div>
                    <div className="text-muted-foreground">{item.status}</div>
                  </div>
                  <div className="mt-2 space-y-2 text-muted-foreground">
                    <div>
                      <span className="font-semibold text-foreground">Intent:</span>{" "}
                      {item.intent}
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">Goals:</span>{" "}
                      {item.goals}
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">
                        Time commitment:
                      </span>{" "}
                      {item.time_commitment}
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">
                        Work interest:
                      </span>{" "}
                      {item.work_interest}
                    </div>
                    {item.past_work ? (
                      <div>
                        <span className="font-semibold text-foreground">
                          Past work:
                        </span>{" "}
                        {item.past_work}
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-border px-3 py-1 text-xs hover:bg-muted"
                      onClick={() => handleHostDecision(item.id, "approve")}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-border px-3 py-1 text-xs hover:bg-muted"
                      onClick={() => handleHostDecision(item.id, "reject")}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No applications yet.</p>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
