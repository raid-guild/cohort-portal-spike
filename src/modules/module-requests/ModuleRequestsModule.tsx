"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type ModuleRequest = {
  id: string;
  module_id: string;
  title: string;
  owner_contact: string | null;
  status: string;
  votes_count: number;
  promotion_threshold: number;
  github_issue_url: string | null;
  created_at: string;
  created_by: string;
  spec: Record<string, unknown>;
};

type ListResponse = { items: ModuleRequest[] };

type DetailResponse = { item: ModuleRequest; hasVoted: boolean };

type Tab = "new" | "trending" | "ready" | "mine";

async function authedFetch<T>(
  token: string,
  input: RequestInfo,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
      authorization: `Bearer ${token}`,
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = json?.error ?? `Request failed (${res.status})`;
    throw new Error(message);
  }
  return json as T;
}

export function ModuleRequestsModule() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);

  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("new");
  const [items, setItems] = useState<ModuleRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<DetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [createForm, setCreateForm] = useState({
    module_id: "",
    title: "",
    owner_contact: "",
    problem: "",
    scope: "",
    ux: "",
    testing: "",
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setToken(data.session?.access_token ?? null);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token ?? null);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  async function loadList(nextTab = tab) {
    if (!token) return;
    setError(null);

    const params = new URLSearchParams();
    if (nextTab === "mine") {
      params.set("status", "mine");
      params.set("sort", "new");
    } else {
      params.set("sort", nextTab);
      if (nextTab === "ready") params.set("status", "ready");
    }

    const data = await authedFetch<ListResponse>(
      token,
      `/api/modules/module-requests?${params.toString()}`,
    );
    setItems(data.items);
  }

  async function loadDetail(id: string) {
    if (!token) return;
    setError(null);
    const data = await authedFetch<DetailResponse>(
      token,
      `/api/modules/module-requests/${id}`,
    );
    setSelected(data);
  }

  useEffect(() => {
    void loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tab]);

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }
    void loadDetail(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, token]);

  async function createDraft() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const spec = {
        module_id: createForm.module_id.trim(),
        owner: createForm.owner_contact.trim(),
        problem: createForm.problem.trim(),
        scope: createForm.scope.trim(),
        ux: createForm.ux.trim(),
        testing: createForm.testing.trim(),
      };

      await authedFetch<{ item: ModuleRequest }>(token, "/api/modules/module-requests", {
        method: "POST",
        body: JSON.stringify({
          module_id: createForm.module_id,
          title: createForm.title,
          owner_contact: createForm.owner_contact,
          spec,
        }),
      });

      setCreateForm({
        module_id: "",
        title: "",
        owner_contact: "",
        problem: "",
        scope: "",
        ux: "",
        testing: "",
      });

      await loadList(tab);
      setTab("mine");
      await loadList("mine");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create request.");
    } finally {
      setBusy(false);
    }
  }

  async function publishSelected() {
    if (!token || !selected?.item) return;
    setBusy(true);
    setError(null);
    try {
      await authedFetch(token, `/api/modules/module-requests/${selected.item.id}/publish`, {
        method: "POST",
      });
      await loadDetail(selected.item.id);
      await loadList(tab);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to publish.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleVote() {
    if (!token || !selected?.item) return;
    setBusy(true);
    setError(null);
    try {
      if (selected.hasVoted) {
        await authedFetch(token, `/api/modules/module-requests/${selected.item.id}/vote`, {
          method: "DELETE",
        });
      } else {
        await authedFetch(token, `/api/modules/module-requests/${selected.item.id}/vote`, {
          method: "POST",
        });
      }

      await loadDetail(selected.item.id);
      await loadList(tab);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to vote.");
    } finally {
      setBusy(false);
    }
  }

  async function promoteToGithub() {
    if (!token || !selected?.item) return;
    setBusy(true);
    setError(null);
    try {
      const data = await authedFetch<{ markdown: string }>(
        token,
        `/api/modules/module-requests/${selected.item.id}/promote`,
        { method: "POST", body: JSON.stringify({}) },
      );

      await navigator.clipboard.writeText(data.markdown);
      alert("Copied GitHub issue markdown to clipboard.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to promote.");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <h1 className="text-3xl font-semibold">Module Requests</h1>
        <p className="text-sm text-muted-foreground">Sign in to create and vote on requests.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Module Requests</h1>
        <p className="text-sm text-muted-foreground">
          Propose new portal modules and signal interest. When votes hit the threshold, requests become
          ready for GitHub.
        </p>
      </div>

      {error ? <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</div> : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["new", "New"],
                ["trending", "Trending"],
                ["ready", "Ready"],
                ["mine", "Mine"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  tab === key ? "border-foreground" : "border-border hover:bg-muted"
                }`}
                onClick={() => {
                  setTab(key);
                  setSelectedId(null);
                }}
                disabled={busy}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {items.length === 0 ? (
              <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
                No requests yet.
              </div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  className={`w-full rounded-xl border p-4 text-left hover:bg-muted ${
                    selectedId === item.id ? "border-foreground" : "border-border"
                  }`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-base font-medium">{item.title}</div>
                      <div className="text-xs text-muted-foreground">{item.module_id}</div>
                      <div className="text-xs text-muted-foreground">Status: {item.status}</div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-medium">{item.votes_count}</div>
                      <div className="text-xs text-muted-foreground">votes</div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border p-4">
            <div className="mb-3 text-sm font-medium">Create request (draft)</div>
            <div className="space-y-3">
              <label className="block">
                <div className="mb-1 text-xs text-muted-foreground">Title</div>
                <input
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  value={createForm.title}
                  onChange={(e) => setCreateForm((s) => ({ ...s, title: e.target.value }))}
                />
              </label>

              <label className="block">
                <div className="mb-1 text-xs text-muted-foreground">Module ID (kebab-case)</div>
                <input
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  value={createForm.module_id}
                  onChange={(e) => setCreateForm((s) => ({ ...s, module_id: e.target.value }))}
                />
              </label>

              <label className="block">
                <div className="mb-1 text-xs text-muted-foreground">Owner / contact</div>
                <input
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  value={createForm.owner_contact}
                  onChange={(e) => setCreateForm((s) => ({ ...s, owner_contact: e.target.value }))}
                />
              </label>

              <label className="block">
                <div className="mb-1 text-xs text-muted-foreground">Problem</div>
                <textarea
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  rows={3}
                  value={createForm.problem}
                  onChange={(e) => setCreateForm((s) => ({ ...s, problem: e.target.value }))}
                />
              </label>

              <label className="block">
                <div className="mb-1 text-xs text-muted-foreground">Scope</div>
                <textarea
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  rows={3}
                  value={createForm.scope}
                  onChange={(e) => setCreateForm((s) => ({ ...s, scope: e.target.value }))}
                />
              </label>

              <label className="block">
                <div className="mb-1 text-xs text-muted-foreground">UX</div>
                <textarea
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  rows={3}
                  value={createForm.ux}
                  onChange={(e) => setCreateForm((s) => ({ ...s, ux: e.target.value }))}
                />
              </label>

              <label className="block">
                <div className="mb-1 text-xs text-muted-foreground">Testing (optional)</div>
                <textarea
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  rows={2}
                  value={createForm.testing}
                  onChange={(e) => setCreateForm((s) => ({ ...s, testing: e.target.value }))}
                />
              </label>

              <button
                className="w-full rounded-lg bg-foreground px-3 py-2 text-sm text-background disabled:opacity-50"
                disabled={busy || !createForm.title.trim() || !createForm.module_id.trim()}
                onClick={() => void createDraft()}
              >
                {busy ? "Working…" : "Create draft"}
              </button>
            </div>
          </div>

          {selected ? (
            <div className="rounded-xl border border-border p-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Selected</div>
                <div className="text-base font-semibold">{selected.item.title}</div>
                <div className="text-xs text-muted-foreground">{selected.item.module_id}</div>
                <div className="text-xs text-muted-foreground">Status: {selected.item.status}</div>
                <div className="text-xs text-muted-foreground">
                  Votes: {selected.item.votes_count} / {selected.item.promotion_threshold}
                </div>

                {selected.item.github_issue_url ? (
                  <a
                    href={selected.item.github_issue_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm underline"
                  >
                    GitHub issue
                  </a>
                ) : null}

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
                    disabled={busy || !new Set(["open", "ready"]).has(selected.item.status)}
                    onClick={() => void toggleVote()}
                  >
                    {selected.hasVoted ? "Unvote" : "Vote"}
                  </button>

                  <button
                    className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
                    disabled={busy || selected.item.status !== "draft"}
                    onClick={() => void publishSelected()}
                  >
                    Publish
                  </button>

                  <button
                    className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
                    disabled={busy || selected.item.status !== "ready"}
                    onClick={() => void promoteToGithub()}
                    title="Host-only; copies markdown"
                  >
                    Promote (copy markdown)
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
              Select a request to view details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
