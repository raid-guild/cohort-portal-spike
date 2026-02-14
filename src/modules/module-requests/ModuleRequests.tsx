"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type ModuleRequestStatus =
  | "draft"
  | "open"
  | "ready"
  | "submitted_to_github"
  | "archived";

type ModuleRequest = {
  id: string;
  created_by: string;
  module_id: string;
  title: string;
  owner_contact: string | null;
  status: ModuleRequestStatus;
  spec: Record<string, unknown>;
  votes_count: number;
  promotion_threshold: number;
  github_issue_url: string | null;
  submitted_to_github_at: string | null;
  created_at: string;
  updated_at: string;
  viewer_has_voted?: boolean;
};

type ListSort = "new" | "trending" | "ready";

type Tab = "new" | "trending" | "ready" | "archived";

const TAB_TO_QUERY: Record<Tab, { sort: ListSort; status?: ModuleRequestStatus }>= {
  new: { sort: "new", status: "open" },
  trending: { sort: "trending", status: "open" },
  ready: { sort: "ready", status: "ready" },
  archived: { sort: "new", status: "archived" },
};

function formatDate(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  return date.toLocaleDateString();
}

export function ModuleRequests() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [tab, setTab] = useState<Tab>("new");
  const [items, setItems] = useState<ModuleRequest[]>([]);
  const [selected, setSelected] = useState<ModuleRequest | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createTitle, setCreateTitle] = useState("");
  const [createModuleId, setCreateModuleId] = useState("");
  const [createProblem, setCreateProblem] = useState("");
  const [createScope, setCreateScope] = useState("");
  const [createUx, setCreateUx] = useState("");

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setItems([]);
        setSelected(null);
        setError("You must be signed in to browse module requests.");
        return;
      }

      const q = TAB_TO_QUERY[tab];
      const url = new URL("/api/modules/module-requests", window.location.origin);
      url.searchParams.set("sort", q.sort);
      if (q.status) url.searchParams.set("status", q.status);

      const res = await fetch(url.toString(), {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as { items?: ModuleRequest[]; error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to load requests.");
      }
      const nextItems = json.items ?? [];
      setItems(nextItems);
      setSelected((prev) => {
        if (!prev) return prev;
        return nextItems.find((r) => r.id === prev.id) ?? null;
      });
    } catch (err) {
      setItems([]);
      setSelected(null);
      setError(err instanceof Error ? err.message : "Failed to load requests.");
    } finally {
      setLoading(false);
    }
  }, [supabase, tab]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const openDetail = async (id: string) => {
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setError("You must be signed in.");
        return;
      }
      const res = await fetch(`/api/modules/module-requests/${id}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as { item?: ModuleRequest; error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to load request.");
      }
      setSelected(json.item ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load request.");
    }
  };

  const createDraft = async () => {
    setSaving(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setError("You must be signed in.");
        return;
      }

      const res = await fetch("/api/modules/module-requests", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: createTitle,
          module_id: createModuleId,
          spec: {
            problem: createProblem,
            scope: createScope,
            ux: createUx,
          },
        }),
      });

      const json = (await res.json()) as { item?: ModuleRequest; error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to create request.");
      }

      setCreateTitle("");
      setCreateModuleId("");
      setCreateProblem("");
      setCreateScope("");
      setCreateUx("");

      await loadList();
      if (json.item?.id) {
        await openDetail(json.item.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create request.");
    } finally {
      setSaving(false);
    }
  };

  const publish = async (id: string) => {
    setSaving(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setError("You must be signed in.");
        return;
      }

      const res = await fetch(`/api/modules/module-requests/${id}/publish`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as { item?: ModuleRequest; error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to publish request.");
      }

      setSelected(json.item ?? null);
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish request.");
    } finally {
      setSaving(false);
    }
  };

  const vote = async (id: string, next: boolean) => {
    const current = selected?.id === id ? selected : items.find((r) => r.id === id);
    if (current && !(current.status === "open" || current.status === "ready")) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setError("You must be signed in.");
        return;
      }

      const res = await fetch(`/api/modules/module-requests/${id}/vote`, {
        method: next ? "POST" : "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as { item?: ModuleRequest; error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to update vote.");
      }

      setSelected(json.item ?? null);
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update vote.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            {(["new", "trending", "ready", "archived"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setSelected(null);
                  setTab(t);
                }}
                className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm ${
                  tab === t
                    ? "bg-primary text-primary-foreground"
                    : "border border-border hover:bg-muted"
                }`}
              >
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => loadList()}
              className="ml-auto inline-flex h-9 items-center justify-center rounded-lg border border-border px-3 text-sm hover:bg-muted"
            >
              Refresh
            </button>
          </div>

          {loading && !items.length ? (
            <div className="mt-3 text-sm text-muted-foreground">Loading…</div>
          ) : null}

          {!loading && !items.length ? (
            <div className="mt-3 text-sm text-muted-foreground">No requests found.</div>
          ) : null}

          {items.length ? (
            <div className="mt-4 grid gap-3">
              {items.map((r) => {
                const isReady = r.status === "ready";
                const voted = Boolean(r.viewer_has_voted);
                return (
                  <div
                    key={r.id}
                    className={`rounded-xl border border-border p-4 ${
                      selected?.id === r.id ? "bg-muted/40" : "bg-card"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <button
                          type="button"
                          onClick={() => openDetail(r.id)}
                          className="text-left text-sm font-semibold hover:underline"
                        >
                          {r.title}
                        </button>
                        <div className="mt-1 text-xs text-muted-foreground">
                          <span className="font-mono">{r.module_id}</span>
                          <span className="mx-2">·</span>
                          <span>{formatDate(r.created_at)}</span>
                          <span className="mx-2">·</span>
                          <span className="capitalize">{r.status.replaceAll("_", " ")}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{r.votes_count}</div>
                        <div className="text-[11px] text-muted-foreground">votes</div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={saving || !(r.status === "open" || r.status === "ready")}
                        onClick={() => vote(r.id, !voted)}
                        className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm ${
                          voted ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"
                        } disabled:opacity-60`}
                      >
                        {voted ? "Voted" : "Vote"}
                      </button>
                      <div className="text-xs text-muted-foreground">
                        {r.votes_count} / {r.promotion_threshold} {isReady ? "(Ready)" : "to Ready"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-sm font-semibold">Create a request (draft)</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Minimal v0 form. You can expand details after creation.
          </p>

          <div className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-xs text-muted-foreground">Title *</span>
              <input
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                className="h-10 rounded-lg border border-border bg-background px-3"
                placeholder="e.g. Module Requests"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-xs text-muted-foreground">module_id (kebab-case) *</span>
              <input
                value={createModuleId}
                onChange={(e) => setCreateModuleId(e.target.value)}
                className="h-10 rounded-lg border border-border bg-background px-3 font-mono"
                placeholder="e.g. module-requests"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-xs text-muted-foreground">Problem *</span>
              <textarea
                value={createProblem}
                onChange={(e) => setCreateProblem(e.target.value)}
                className="min-h-20 rounded-lg border border-border bg-background p-3"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-xs text-muted-foreground">Scope *</span>
              <textarea
                value={createScope}
                onChange={(e) => setCreateScope(e.target.value)}
                className="min-h-20 rounded-lg border border-border bg-background p-3"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-xs text-muted-foreground">UX *</span>
              <textarea
                value={createUx}
                onChange={(e) => setCreateUx(e.target.value)}
                className="min-h-20 rounded-lg border border-border bg-background p-3"
              />
            </label>

            <button
              type="button"
              disabled={saving}
              onClick={() => createDraft()}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save draft"}
            </button>
          </div>
        </div>

        {error ? <div className="text-sm text-red-500">{error}</div> : null}
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-sm font-semibold">Request detail</div>
          {!selected ? (
            <div className="mt-3 text-sm text-muted-foreground">
              Select a request to see the full spec.
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <div>
                <div className="text-lg font-semibold">{selected.title}</div>
                <div className="text-xs text-muted-foreground">
                  <span className="font-mono">{selected.module_id}</span>
                  <span className="mx-2">·</span>
                  <span className="capitalize">{selected.status.replaceAll("_", " ")}</span>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    Votes: <span className="font-semibold">{selected.votes_count}</span>
                    <span className="text-muted-foreground">
                      {" "}/ {selected.promotion_threshold}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={saving || !(selected.status === "open" || selected.status === "ready")}
                    onClick={() => vote(selected.id, !selected.viewer_has_voted)}
                    className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm ${
                      selected.viewer_has_voted
                        ? "bg-primary text-primary-foreground"
                        : "border border-border hover:bg-muted"
                    } disabled:opacity-60`}
                  >
                    {selected.viewer_has_voted ? "Voted" : "Vote"}
                  </button>
                </div>
              </div>

              {selected.status === "draft" ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => publish(selected.id)}
                  className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-border px-4 text-sm hover:bg-muted disabled:opacity-60"
                >
                  {saving ? "Publishing…" : "Publish (draft → open)"}
                </button>
              ) : null}

              {selected.github_issue_url ? (
                <a
                  href={selected.github_issue_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-sm text-primary hover:underline"
                >
                  View GitHub issue
                </a>
              ) : null}

              <div className="space-y-3">
                {([
                  ["Problem", selected.spec?.problem],
                  ["Scope", selected.spec?.scope],
                  ["UX", selected.spec?.ux],
                  ["Storage", selected.spec?.storage],
                  ["Data model", selected.spec?.data_model],
                  ["API", selected.spec?.api],
                  ["Acceptance", selected.spec?.acceptance],
                  ["Testing", selected.spec?.testing],
                  ["Portal RPC", selected.spec?.portal_rpc],
                  ["Allowed origins", selected.spec?.allowed_origins],
                ] as Array<[string, unknown]>).map(([label, value]) => {
                  const text = typeof value === "string" ? value : "";
                  if (!text.trim()) return null;
                  return (
                    <div key={label}>
                      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
                      <pre className="mt-1 whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-sm">
                        {text}
                      </pre>
                    </div>
                  );
                })}
              </div>

              <div className="text-xs text-muted-foreground">
                Created: {formatDate(selected.created_at)} · Updated: {formatDate(selected.updated_at)}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-sm font-semibold">Host promotion</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Promotion is host-only and is available via the API endpoint:
          </p>
          <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-xs">
            POST /api/modules/module-requests/:id/promote
          </pre>
          <p className="mt-2 text-sm text-muted-foreground">
            This returns a GitHub-ready markdown body. Optionally provide a
            <span className="font-mono"> github_issue_url</span> to store the link and
            transition to <span className="font-mono">submitted_to_github</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
