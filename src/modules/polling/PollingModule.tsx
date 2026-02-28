"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type PollListItem = {
  id: string;
  title: string;
  description: string | null;
  opens_at: string;
  closes_at: string;
  state: "upcoming" | "open" | "closed";
  votes_count: number;
  viewer_vote_option_id: string | null;
  viewer: {
    can_vote: boolean;
    can_view_results: boolean;
    can_close: boolean;
  };
};

type PollOption = {
  id: string;
  label: string;
  subject_user_id: string | null;
  votes_count: number | null;
};

type PollDetail = {
  poll: {
    id: string;
    title: string;
    description: string | null;
    opens_at: string;
    closes_at: string;
    state: "upcoming" | "open" | "closed";
    allow_vote_change: boolean;
    results_visible: boolean;
    totals: { total_votes: number };
    viewer: {
      can_vote: boolean;
      can_close: boolean;
    };
  };
  options: PollOption[];
  viewer_vote: { option_id: string } | null;
};

type PollListResponse = { items: PollListItem[] };

type TabKey = "upcoming" | "open" | "closed";

export function PollingModule() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("open");
  const [polls, setPolls] = useState<PollListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PollDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      setToken(data.session?.access_token ?? null);
    };

    void load();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!token) {
      setPolls([]);
      setSelectedId(null);
      setDetail(null);
      return;
    }

    void loadPolls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tab]);

  useEffect(() => {
    if (!token || !selectedId) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedId]);

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

  async function loadPolls() {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await authedFetch<PollListResponse>(`/api/modules/polling?status=${tab}&limit=50`);
      const next = res.items ?? [];
      setPolls(next);
      setSelectedId((current) => (current && next.some((item) => item.id === current) ? current : next[0]?.id ?? null));
    } catch (err) {
      setPolls([]);
      setSelectedId(null);
      setDetail(null);
      setError(err instanceof Error ? err.message : "Failed to load polls.");
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(pollId: string) {
    setError(null);
    try {
      const res = await authedFetch<PollDetail>(`/api/modules/polling/${pollId}`);
      setDetail(res);
    } catch (err) {
      setDetail(null);
      setError(err instanceof Error ? err.message : "Failed to load poll details.");
    }
  }

  async function castVote(optionId: string) {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await authedFetch(`/api/modules/polling/${selectedId}/vote`, {
        method: "POST",
        body: JSON.stringify({ option_id: optionId }),
      });
      setMessage("Vote saved.");
      await Promise.all([loadPolls(), loadDetail(selectedId)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save vote.");
    } finally {
      setBusy(false);
    }
  }

  async function closePoll() {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await authedFetch(`/api/modules/polling/${selectedId}/close`, {
        method: "POST",
      });
      setMessage("Poll closed.");
      await Promise.all([loadPolls(), loadDetail(selectedId)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close poll.");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
        Sign in to view and vote in polls.
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="space-y-3">
        <div className="flex gap-2">
          {(["upcoming", "open", "closed"] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                tab === item ? "border-foreground" : "border-border hover:bg-muted"
              }`}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {loading ? <div className="text-sm text-muted-foreground">Loading polls...</div> : null}
          {!loading && polls.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              No polls in this tab.
            </div>
          ) : null}
          {polls.map((poll) => (
            <button
              key={poll.id}
              type="button"
              className={`w-full rounded-xl border p-3 text-left ${
                selectedId === poll.id ? "border-foreground" : "border-border hover:bg-muted"
              }`}
              onClick={() => setSelectedId(poll.id)}
            >
              <div className="font-medium">{poll.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">{new Date(poll.closes_at).toLocaleString()}</div>
              <div className="mt-1 text-xs text-muted-foreground">{poll.votes_count} vote(s)</div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        {error ? <div className="mb-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
        {message ? <div className="mb-3 rounded-lg bg-emerald-600/10 p-3 text-sm text-emerald-700">{message}</div> : null}

        {!detail ? <div className="text-sm text-muted-foreground">Select a poll to view details.</div> : null}

        {detail ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">{detail.poll.title}</h2>
              {detail.poll.description ? (
                <p className="mt-1 text-sm text-muted-foreground">{detail.poll.description}</p>
              ) : null}
              <div className="mt-2 text-xs text-muted-foreground">
                Opens: {new Date(detail.poll.opens_at).toLocaleString()} | Closes: {new Date(detail.poll.closes_at).toLocaleString()}
              </div>
            </div>

            <div className="space-y-2">
              {detail.options.map((option) => {
                const selected = detail.viewer_vote?.option_id === option.id;
                return (
                  <div key={option.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">{option.label}</div>
                        {detail.poll.results_visible ? (
                          <div className="text-xs text-muted-foreground">{option.votes_count ?? 0} vote(s)</div>
                        ) : (
                          <div className="text-xs text-muted-foreground">Results hidden until poll closes.</div>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={busy || !detail.poll.viewer.can_vote}
                        className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => castVote(option.id)}
                      >
                        {selected ? "Selected" : "Vote"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-muted-foreground">Total votes: {detail.poll.totals.total_votes}</span>
              {detail.poll.allow_vote_change ? (
                <span className="text-muted-foreground">Vote changes enabled</span>
              ) : (
                <span className="text-muted-foreground">Single vote only</span>
              )}
              {detail.poll.viewer.can_close ? (
                <button
                  type="button"
                  className="rounded-lg border border-border px-3 py-1.5 text-sm"
                  onClick={() => closePoll()}
                  disabled={busy || detail.poll.state === "closed"}
                >
                  Close poll
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
