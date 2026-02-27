"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { MarkdownEditor } from "@/modules/_shared/MarkdownEditor";

type FeedbackType = "bug" | "feature" | "feedback" | "module_request";
type FeedbackStatus = "new" | "triaged" | "in_progress" | "done" | "closed";
type FeedbackPriority = "low" | "medium" | "high";

type FeedbackItem = {
  id: string;
  type: FeedbackType;
  title: string;
  description_md: string;
  steps_to_reproduce_md: string | null;
  expected_result_md: string | null;
  actual_result_md: string | null;
  problem_md: string | null;
  proposed_outcome_md: string | null;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  module_id: string | null;
  route_path: string | null;
  reporter_user_id: string;
  assignee_user_id: string | null;
  triage_notes: string | null;
  created_at: string;
  updated_at: string;
};

type TabKey = "submit" | "my-reports" | "triage";

type ListResponse = {
  items: FeedbackItem[];
  nextCursor: string | null;
  mine: boolean;
};

const TYPE_OPTIONS: FeedbackType[] = ["bug", "feature", "feedback", "module_request"];
const STATUS_OPTIONS: FeedbackStatus[] = ["new", "triaged", "in_progress", "done", "closed"];
const PRIORITY_OPTIONS: FeedbackPriority[] = ["low", "medium", "high"];

export function FeedbackCenter() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [token, setToken] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [tab, setTab] = useState<TabKey>("submit");

  const [submitType, setSubmitType] = useState<FeedbackType>("feedback");
  const [title, setTitle] = useState("");
  const [descriptionMd, setDescriptionMd] = useState("");
  const [stepsMd, setStepsMd] = useState("");
  const [expectedMd, setExpectedMd] = useState("");
  const [actualMd, setActualMd] = useState("");
  const [problemMd, setProblemMd] = useState("");
  const [proposedOutcomeMd, setProposedOutcomeMd] = useState("");
  const [moduleId, setModuleId] = useState("feedback-center");

  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [triageType, setTriageType] = useState("");
  const [triageStatus, setTriageStatus] = useState("");
  const [triagePriority, setTriagePriority] = useState("");

  const isHost = roles.includes("host") || roles.includes("admin");

  useEffect(() => {
    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token ?? null;
      setToken(accessToken);

      if (accessToken) {
        const res = await fetch("/api/me/roles", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const json = (await res.json().catch(() => ({}))) as { roles?: string[] };
        setRoles(json.roles ?? []);
      } else {
        setRoles([]);
      }
    };

    void loadSession();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token ?? null);
      if (!session?.access_token) setRoles([]);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!token) return;
    if (tab === "submit") return;
    void loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tab, triageType, triageStatus, triagePriority]);

  async function authedFetch<T>(path: string, init?: RequestInit): Promise<T> {
    if (!token) {
      throw new Error("Missing auth token.");
    }

    const res = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    });

    const json = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) {
      throw new Error(json.error ?? `Request failed (${res.status})`);
    }

    return json;
  }

  async function loadItems() {
    setLoadingItems(true);
    setError(null);
    setMessage(null);

    try {
      const params = new URLSearchParams();
      if (tab === "my-reports") {
        params.set("mine", "true");
      }
      if (tab === "triage") {
        params.set("mine", "false");
        if (triageType) params.set("type", triageType);
        if (triageStatus) params.set("status", triageStatus);
        if (triagePriority) params.set("priority", triagePriority);
      }

      const data = await authedFetch<ListResponse>(
        `/api/modules/feedback-center/items?${params.toString()}`,
      );
      setItems(data.items ?? []);
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : "Failed to load feedback items.");
    } finally {
      setLoadingItems(false);
    }
  }

  async function submitFeedback(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const payload = {
        type: submitType,
        title,
        description_md: descriptionMd,
        steps_to_reproduce_md: submitType === "bug" ? stepsMd : null,
        expected_result_md: submitType === "bug" ? expectedMd : null,
        actual_result_md: submitType === "bug" ? actualMd : null,
        problem_md: submitType === "feature" || submitType === "module_request" ? problemMd : null,
        proposed_outcome_md:
          submitType === "feature" || submitType === "module_request" ? proposedOutcomeMd : null,
        module_id: moduleId || null,
        route_path: typeof window !== "undefined" ? window.location.pathname : null,
        browser_meta:
          typeof window !== "undefined"
            ? {
                userAgent: window.navigator.userAgent,
              }
            : null,
      };

      const data = await authedFetch<{ trackingId: string }>(
        "/api/modules/feedback-center/items",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );

      setMessage(`Submitted. Tracking ID: ${data.trackingId}`);
      setTitle("");
      setDescriptionMd("");
      setStepsMd("");
      setExpectedMd("");
      setActualMd("");
      setProblemMd("");
      setProposedOutcomeMd("");
      setTab("my-reports");
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit feedback.");
    } finally {
      setBusy(false);
    }
  }

  async function updateTriage(itemId: string, patch: Record<string, string | null>) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await authedFetch(`/api/modules/feedback-center/items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setMessage("Triage updated.");
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update triage.");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
        Sign in to submit and track feedback reports.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-lg border px-3 py-1.5 text-sm ${
            tab === "submit" ? "border-foreground" : "border-border hover:bg-muted"
          }`}
          onClick={() => setTab("submit")}
        >
          Submit
        </button>
        <button
          type="button"
          className={`rounded-lg border px-3 py-1.5 text-sm ${
            tab === "my-reports" ? "border-foreground" : "border-border hover:bg-muted"
          }`}
          onClick={() => setTab("my-reports")}
        >
          My reports
        </button>
        <button
          type="button"
          className={`rounded-lg border px-3 py-1.5 text-sm ${
            tab === "triage" ? "border-foreground" : "border-border hover:bg-muted"
          }`}
          onClick={() => setTab("triage")}
        >
          Triage
        </button>
      </div>

      {message ? (
        <div className="rounded-lg border border-emerald-600/30 bg-emerald-600/10 p-3 text-sm">{message}</div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">{error}</div>
      ) : null}

      {tab === "submit" ? (
        <form onSubmit={submitFeedback} className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Type</span>
              <select
                value={submitType}
                onChange={(event) => setSubmitType(event.target.value as FeedbackType)}
                className="rounded-lg border border-border bg-background px-3 py-2"
              >
                {TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Module ID (optional)</span>
              <input
                value={moduleId}
                onChange={(event) => setModuleId(event.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2"
                placeholder="feedback-center"
              />
            </label>
          </div>

          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2"
              required
            />
          </label>

          <div className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Description (Markdown)</span>
            <MarkdownEditor value={descriptionMd} onChange={setDescriptionMd} minHeightClassName="min-h-32" />
          </div>

          {submitType === "bug" ? (
            <div className="space-y-4 rounded-lg border border-border bg-background p-4">
              <div className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Steps to reproduce (Markdown)</span>
                <MarkdownEditor value={stepsMd} onChange={setStepsMd} minHeightClassName="min-h-28" />
              </div>
              <div className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Expected result (Markdown)</span>
                <MarkdownEditor value={expectedMd} onChange={setExpectedMd} minHeightClassName="min-h-24" />
              </div>
              <div className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Actual result (Markdown)</span>
                <MarkdownEditor value={actualMd} onChange={setActualMd} minHeightClassName="min-h-24" />
              </div>
            </div>
          ) : null}

          {(submitType === "feature" || submitType === "module_request") ? (
            <div className="space-y-4 rounded-lg border border-border bg-background p-4">
              <div className="grid gap-1 text-sm">
                <span className="text-muted-foreground">User problem (Markdown)</span>
                <MarkdownEditor value={problemMd} onChange={setProblemMd} minHeightClassName="min-h-24" />
              </div>
              <div className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Proposed outcome (Markdown)</span>
                <MarkdownEditor
                  value={proposedOutcomeMd}
                  onChange={setProposedOutcomeMd}
                  minHeightClassName="min-h-24"
                />
              </div>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-60"
          >
            {busy ? "Submitting..." : "Submit report"}
          </button>
        </form>
      ) : null}

      {tab === "my-reports" ? (
        <section className="space-y-3">
          {loadingItems ? <div className="text-sm text-muted-foreground">Loading reports...</div> : null}
          {!loadingItems && !items.length ? (
            <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
              No personal submissions yet.
            </div>
          ) : null}
          {items.map((item) => (
            <article key={item.id} className="space-y-2 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">{item.title}</h3>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border px-2 py-0.5">{item.type}</span>
                  <span className="rounded-full border px-2 py-0.5">{item.status}</span>
                  <span className="rounded-full border px-2 py-0.5">{item.priority}</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">Tracking ID: {item.id}</div>
            </article>
          ))}
        </section>
      ) : null}

      {tab === "triage" ? (
        <section className="space-y-3">
          {!isHost ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
              Permission denied: triage is restricted to host/admin users.
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <select
                  value={triageType}
                  onChange={(event) => setTriageType(event.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">All types</option>
                  {TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <select
                  value={triageStatus}
                  onChange={(event) => setTriageStatus(event.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">All statuses</option>
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <select
                  value={triagePriority}
                  onChange={(event) => setTriagePriority(event.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">All priorities</option>
                  {PRIORITY_OPTIONS.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </div>

              {loadingItems ? <div className="text-sm text-muted-foreground">Loading triage queue...</div> : null}
              {!loadingItems && !items.length ? (
                <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
                  No reports found for current filters.
                </div>
              ) : null}
              {items.map((item) => (
                <article key={item.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">{item.title}</h3>
                    <div className="text-xs text-muted-foreground">Reporter: {item.reporter_user_id}</div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-4">
                    <label className="grid gap-1 text-xs">
                      <span className="text-muted-foreground">Status</span>
                      <select
                        value={item.status}
                        onChange={(event) =>
                          void updateTriage(item.id, { status: event.target.value })
                        }
                        className="rounded border border-border bg-background px-2 py-1"
                        disabled={busy}
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs">
                      <span className="text-muted-foreground">Priority</span>
                      <select
                        value={item.priority}
                        onChange={(event) =>
                          void updateTriage(item.id, { priority: event.target.value })
                        }
                        className="rounded border border-border bg-background px-2 py-1"
                        disabled={busy}
                      >
                        {PRIORITY_OPTIONS.map((priority) => (
                          <option key={priority} value={priority}>
                            {priority}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs sm:col-span-2">
                      <span className="text-muted-foreground">Triage notes</span>
                      <input
                        defaultValue={item.triage_notes ?? ""}
                        onBlur={(event) =>
                          void updateTriage(item.id, { triage_notes: event.target.value || null })
                        }
                        className="rounded border border-border bg-background px-2 py-1"
                        placeholder="Add notes and blur to save"
                        disabled={busy}
                      />
                    </label>
                  </div>
                </article>
              ))}
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
