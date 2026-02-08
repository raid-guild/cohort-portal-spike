"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type Bounty = {
  id: string;
  title: string;
  description: string;
  status: string;
  github_url: string | null;
  reward_type: string;
  reward_amount: number | null;
  reward_token: string | null;
  badge_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  due_at: string | null;
  tags: string[] | null;
};

type Claim = {
  id: string;
  bounty_id: string;
  user_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  resolved_at: string | null;
};

type Comment = {
  id: string;
  bounty_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

type DetailResponse = {
  bounty: Bounty;
  activeClaim: Claim | null;
  comments: Comment[];
};

const statusOptions = ["all", "open", "claimed", "submitted", "accepted", "closed"];

function safeHttpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function BountyBoard() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [token, setToken] = useState<string | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const isHost = roles.includes("host");

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailResponse | null>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newGithubUrl, setNewGithubUrl] = useState("");

  const [commentBody, setCommentBody] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const sessionToken = data.session?.access_token ?? null;
      const sessionUserId = data.session?.user?.id ?? null;
      if (!cancelled) {
        setToken(sessionToken);
        setViewerId(sessionUserId);
      }

      if (!sessionToken) {
        if (!cancelled) setRoles([]);
        return;
      }

      const rolesRes = await fetch("/api/me/roles", {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const rolesJson = await rolesRes.json();
      if (!cancelled) setRoles(rolesJson.roles ?? []);
    };

    load();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      load();
      setSelectedId(null);
      setDetail(null);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  const loadBounties = async (authToken: string) => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    const res = await fetch(`/api/bounties?${params.toString()}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to load bounties.");
    setBounties(json.bounties ?? []);
  };

  const loadDetail = async (authToken: string, id: string) => {
    const res = await fetch(`/api/bounties/${id}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const json = (await res.json()) as DetailResponse & { error?: string };
    if (!res.ok) throw new Error(json.error || "Failed to load bounty.");
    setDetail(json);
  };

  useEffect(() => {
    if (!token) return;
    setMessage("");
    setLoading(true);
    loadBounties(token)
      .catch((error) => setMessage(error instanceof Error ? error.message : "Failed."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, statusFilter]);

  const selectBounty = async (id: string) => {
    if (!token) return;
    setSelectedId(id);
    setMessage("");
    setLoading(true);
    try {
      await loadDetail(token, id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed.");
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    if (!token) return;
    await loadBounties(token);
    if (selectedId) await loadDetail(token, selectedId);
  };

  const callPost = async (path: string, body?: unknown) => {
    if (!token) throw new Error("Sign in required.");
    const res = await fetch(path, {
      method: "POST",
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Request failed.");
    await refresh();
  };

  const callPut = async (path: string, body: unknown) => {
    if (!token) throw new Error("Sign in required.");
    const res = await fetch(path, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Request failed.");
    await refresh();
  };

  const runAction = async (fn: () => Promise<void>) => {
    setMessage("");
    setLoading(true);
    try {
      await fn();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed.");
    } finally {
      setLoading(false);
    }
  };

  const createBounty = async () => {
    setMessage("");
    setLoading(true);
    try {
      if (!token) throw new Error("Sign in required.");
      const res = await fetch("/api/bounties", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          githubUrl: newGithubUrl || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create bounty.");
      setNewTitle("");
      setNewDescription("");
      setNewGithubUrl("");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">Sign in to view bounties.</p>
      </div>
    );
  }

  const bounty = detail?.bounty;
  const claim = detail?.activeClaim;
  const canClaim = bounty?.status === "open";
  const isClaimer = claim?.user_id && viewerId ? claim.user_id === viewerId : false;

  const safeGithubUrl = bounty?.github_url ? safeHttpUrl(bounty.github_url) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium">Bounties</div>
            <select
              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {statusOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3 space-y-2">
            {bounties.length ? (
              bounties.map((row) => (
                <button
                  key={row.id}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    selectedId === row.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/40"
                  }`}
                  onClick={() => selectBounty(row.id)}
                >
                  <div className="font-medium">{row.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {row.status} · updated {new Date(row.updated_at).toLocaleDateString()}
                  </div>
                </button>
              ))
            ) : (
              <div className="text-xs text-muted-foreground">No bounties found.</div>
            )}
          </div>
        </div>

        {isHost ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm font-medium">Host: create bounty</div>
            <div className="mt-3 space-y-2">
              <input
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                placeholder="Title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <textarea
                className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="Description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
              <input
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                placeholder="GitHub issue URL (optional)"
                value={newGithubUrl}
                onChange={(e) => setNewGithubUrl(e.target.value)}
              />
              <button
                className="h-9 w-full rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50"
                disabled={loading}
                onClick={createBounty}
              >
                Create
              </button>
            </div>
          </div>
        ) : null}

        {message ? (
          <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            {message}
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        {!detail ? (
          <div className="text-sm text-muted-foreground">Select a bounty.</div>
        ) : (
          <div className="space-y-5">
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{bounty?.title}</h2>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Status: {bounty?.status}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canClaim ? (
                    <button
                      className="h-9 rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50"
                      disabled={loading}
                      onClick={() => runAction(() => callPost(`/api/bounties/${bounty?.id}/claim`))}
                    >
                      Claim
                    </button>
                  ) : null}

                  {claim && (isClaimer || isHost) ? (
                    <button
                      className="h-9 rounded-md border border-border px-3 text-sm disabled:opacity-50"
                      disabled={loading}
                      onClick={() => runAction(() => callPost(`/api/bounties/${bounty?.id}/unclaim`))}
                    >
                      Unclaim
                    </button>
                  ) : null}

                  {claim?.status === "claimed" && isClaimer ? (
                    <button
                      className="h-9 rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50"
                      disabled={loading}
                      onClick={() => runAction(() => callPost(`/api/bounties/${bounty?.id}/submit`))}
                    >
                      Mark complete
                    </button>
                  ) : null}

                  {claim?.status === "submitted" && isHost ? (
                    <>
                      <button
                        className="h-9 rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50"
                        disabled={loading}
                        onClick={() => runAction(() => callPost(`/api/bounties/${bounty?.id}/accept`))}
                      >
                        Accept
                      </button>
                      <button
                        className="h-9 rounded-md border border-border px-3 text-sm disabled:opacity-50"
                        disabled={loading}
                        onClick={() => runAction(() => callPost(`/api/bounties/${bounty?.id}/reject`))}
                      >
                        Reject
                      </button>
                    </>
                  ) : null}

                  {isHost && bounty?.status !== "closed" ? (
                    <button
                      className="h-9 rounded-md border border-border px-3 text-sm disabled:opacity-50"
                      disabled={loading}
                      onClick={() =>
                        runAction(() => callPut(`/api/bounties/${bounty?.id}`, { status: "closed" }))
                      }
                    >
                      Close
                    </button>
                  ) : null}
                </div>
              </div>

              {safeGithubUrl ? (
                <div className="mt-3 text-sm">
                  <a
                    className="text-primary underline"
                    href={safeGithubUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    GitHub issue
                  </a>
                </div>
              ) : bounty?.github_url ? (
                <div className="mt-3 text-xs text-muted-foreground">
                  GitHub issue link is invalid.
                </div>
              ) : null}

              <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">
                {bounty?.description}
              </p>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium">Comments</div>
              <div className="space-y-3">
                {detail.comments.length ? (
                  detail.comments.map((c) => (
                    <div key={c.id} className="rounded-lg border border-border p-3">
                      <div className="text-xs text-muted-foreground">
                        {c.user_id.slice(0, 8)} · {new Date(c.created_at).toLocaleString()}
                      </div>
                      <div className="mt-2 whitespace-pre-wrap text-sm">{c.body}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-muted-foreground">No comments yet.</div>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  className="h-9 flex-1 rounded-md border border-border bg-background px-3 text-sm"
                  placeholder="Write a comment"
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                />
                <button
                  className="h-9 rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50"
                  disabled={loading}
                  onClick={async () => {
                    setMessage("");
                    setLoading(true);
                    try {
                      await callPost(`/api/bounties/${bounty?.id}/comments`, {
                        body: commentBody,
                      });
                      setCommentBody("");
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : "Failed.");
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
