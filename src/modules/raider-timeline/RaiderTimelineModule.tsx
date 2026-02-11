"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import {
  createPortalRpcClient,
  emitLocalProfileRefresh,
} from "@/modules/_shared/portalRpc";

type Visibility = "public" | "authenticated" | "private";
type Kind = "note" | "milestone" | "attendance";

type TimelineEntry = {
  id: string;
  kind: Kind;
  title: string;
  body: string | null;
  visibility: Visibility;
  occurredAt: string;
  pinned: boolean;
  createdBy: string | null;
  createdViaRole: string | null;
};

type DraftEntry = {
  kind: Kind;
  title: string;
  body: string;
  visibility: Visibility;
  occurredAt: string;
  pinned: boolean;
};

function toLocalDateTimeInput(iso: string) {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function getJsonError(value: unknown) {
  if (!isRecord(value)) return null;
  const error = value.error;
  return typeof error === "string" ? error : null;
}

function getEmptyDraft(): DraftEntry {
  return {
    kind: "milestone",
    title: "",
    body: "",
    visibility: "public",
    occurredAt: toLocalDateTimeInput(new Date().toISOString()),
    pinned: false,
  };
}

export function RaiderTimelineModule() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const portalRpc = useMemo(() => createPortalRpcClient("raider-timeline"), []);
  const [session, setSession] = useState<Session | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const [items, setItems] = useState<TimelineEntry[]>([]);
  const [draft, setDraft] = useState<DraftEntry>(() => getEmptyDraft());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftEntry>(() => getEmptyDraft());

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session?.user) {
        setHandle(null);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        if (!newSession?.user) {
          setHandle(null);
        }
      },
    );

    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  const fetchEntries = useCallback(
    async (viewerHandle: string, accessToken?: string) => {
      setMessage("");

      try {
        const res = await fetch(
          `/api/modules/raider-timeline/entries?handle=${encodeURIComponent(viewerHandle)}`,
          {
            headers: accessToken
              ? { Authorization: `Bearer ${accessToken}` }
              : undefined,
          },
        );

        let json: unknown = null;
        try {
          json = await res.json();
        } catch {
          json = null;
        }

        if (!res.ok) {
          setMessage(getJsonError(json) || "Failed to load timeline.");
          return;
        }

        if (isRecord(json) && Array.isArray(json.items)) {
          setItems(json.items as TimelineEntry[]);
          return;
        }

        setItems([]);
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Failed to load timeline.",
        );
      }
    },
    [],
  );

  useEffect(() => {
    if (!session?.user) {
      return;
    }

    supabase
      .from("profiles")
      .select("handle")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          setMessage(error.message);
          setHandle(null);
          return;
        }

        const nextHandle = data?.handle ?? null;
        setHandle(nextHandle);
        if (nextHandle) {
          void fetchEntries(nextHandle, session.access_token);
        }
      });
  }, [fetchEntries, supabase, session]);

  const loadEntries = useCallback(async () => {
    if (!handle) return;
    await fetchEntries(handle, session?.access_token);
  }, [fetchEntries, handle, session?.access_token]);

  const createEntry = async () => {
    if (!session?.access_token) {
      setMessage("Please sign in.");
      return;
    }

    const occurredAt = toIsoOrNull(draft.occurredAt);
    if (!occurredAt) {
      setMessage("Please provide a valid date/time.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const res = await fetch("/api/modules/raider-timeline/entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          kind: draft.kind,
          title: draft.title,
          body: draft.body,
          visibility: draft.visibility,
          occurredAt,
          pinned: draft.pinned,
          sourceKind: "manual",
          sourceRef: null,
        }),
      });

      let json: unknown = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      if (!res.ok) {
        setMessage(getJsonError(json) || "Failed to create entry.");
        return;
      }

      setDraft(getEmptyDraft());
      await loadEntries();
      try {
        await portalRpc("profile.refresh", { handle });
      } catch {
        emitLocalProfileRefresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create entry.");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (entry: TimelineEntry) => {
    setEditingId(entry.id);
    setEditDraft({
      kind: entry.kind,
      title: entry.title,
      body: entry.body ?? "",
      visibility: entry.visibility,
      occurredAt: toLocalDateTimeInput(entry.occurredAt),
      pinned: entry.pinned,
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (!session?.access_token) {
      setMessage("Please sign in.");
      return;
    }

    const occurredAt = toIsoOrNull(editDraft.occurredAt);
    if (!occurredAt) {
      setMessage("Please provide a valid date/time.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const res = await fetch(`/api/modules/raider-timeline/entries/${editingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          kind: editDraft.kind,
          title: editDraft.title,
          body: editDraft.body,
          visibility: editDraft.visibility,
          occurredAt,
          pinned: editDraft.pinned,
        }),
      });

      let json: unknown = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      if (!res.ok) {
        setMessage(getJsonError(json) || "Failed to update entry.");
        return;
      }

      setEditingId(null);
      await loadEntries();
      try {
        await portalRpc("profile.refresh", { handle });
      } catch {
        emitLocalProfileRefresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update entry.");
    } finally {
      setBusy(false);
    }
  };

  const deleteEntry = async (id: string) => {
    if (!session?.access_token) {
      setMessage("Please sign in.");
      return;
    }
    if (!confirm("Delete this timeline entry?")) return;

    setBusy(true);
    setMessage("");

    try {
      const res = await fetch(`/api/modules/raider-timeline/entries/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      let json: unknown = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      if (!res.ok) {
        setMessage(getJsonError(json) || "Failed to delete entry.");
        return;
      }

      await loadEntries();
      try {
        await portalRpc("profile.refresh", { handle });
      } catch {
        emitLocalProfileRefresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete entry.");
    } finally {
      setBusy(false);
    }
  };

  if (!session) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Raider Timeline</h1>
        <p className="text-sm text-muted-foreground">Sign in to manage your timeline.</p>
      </div>
    );
  }

  if (!handle) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Raider Timeline</h1>
        <p className="text-sm text-muted-foreground">
          Create your profile first (set a handle) to start using the timeline.
        </p>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Raider Timeline</h1>
        <p className="text-sm text-muted-foreground">
          Add notes and milestones to your profile chronicle.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-sm font-semibold">Add entry</div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Title</span>
            <input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
              placeholder="Shipped v1 of …"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Occurred at</span>
            <input
              type="datetime-local"
              value={draft.occurredAt}
              onChange={(e) => setDraft((d) => ({ ...d, occurredAt: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="text-xs text-muted-foreground">Body (optional)</span>
            <textarea
              value={draft.body}
              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
              className="min-h-[80px] w-full rounded-lg border border-border bg-background px-3 py-2"
              placeholder="Short context…"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Kind</span>
            <select
              value={draft.kind}
              onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as Kind }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            >
              <option value="note">note</option>
              <option value="milestone">milestone</option>
              <option value="attendance">attendance</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Visibility</span>
            <select
              value={draft.visibility}
              onChange={(e) =>
                setDraft((d) => ({ ...d, visibility: e.target.value as Visibility }))
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            >
              <option value="public">public</option>
              <option value="authenticated">authenticated</option>
              <option value="private">private</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={draft.pinned}
              onChange={(e) => setDraft((d) => ({ ...d, pinned: e.target.checked }))}
            />
            Pin
          </label>
          <button
            type="button"
            onClick={createEntry}
            disabled={busy}
            className="rounded-lg border border-border bg-primary px-4 py-2 text-sm text-background hover:opacity-90"
          >
            Save
          </button>
          {message ? <span className="text-sm text-muted-foreground">{message}</span> : null}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-sm font-semibold">Your entries</div>
        {items.length ? (
          <ul className="mt-3 space-y-3">
            {items.map((entry) => (
              <li
                key={entry.id}
                className="rounded-lg border border-border bg-background p-3"
              >
                {editingId === entry.id ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1 text-sm">
                        <span className="text-xs text-muted-foreground">Title</span>
                        <input
                          value={editDraft.title}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, title: e.target.value }))
                          }
                          className="w-full rounded-lg border border-border bg-background px-3 py-2"
                        />
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="text-xs text-muted-foreground">Occurred at</span>
                        <input
                          type="datetime-local"
                          value={editDraft.occurredAt}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, occurredAt: e.target.value }))
                          }
                          className="w-full rounded-lg border border-border bg-background px-3 py-2"
                        />
                      </label>
                      <label className="space-y-1 text-sm md:col-span-2">
                        <span className="text-xs text-muted-foreground">Body</span>
                        <textarea
                          value={editDraft.body}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, body: e.target.value }))
                          }
                          className="min-h-[80px] w-full rounded-lg border border-border bg-background px-3 py-2"
                        />
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="text-xs text-muted-foreground">Kind</span>
                        <select
                          value={editDraft.kind}
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              kind: e.target.value as Kind,
                            }))
                          }
                          className="w-full rounded-lg border border-border bg-background px-3 py-2"
                        >
                          <option value="note">note</option>
                          <option value="milestone">milestone</option>
                          <option value="attendance">attendance</option>
                        </select>
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="text-xs text-muted-foreground">Visibility</span>
                        <select
                          value={editDraft.visibility}
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              visibility: e.target.value as Visibility,
                            }))
                          }
                          className="w-full rounded-lg border border-border bg-background px-3 py-2"
                        >
                          <option value="public">public</option>
                          <option value="authenticated">authenticated</option>
                          <option value="private">private</option>
                        </select>
                      </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-sm text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={editDraft.pinned}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, pinned: e.target.checked }))
                          }
                        />
                        Pin
                      </label>
                      <button
                        type="button"
                        onClick={saveEdit}
                        disabled={busy}
                        className="rounded-lg border border-border bg-primary px-3 py-2 text-sm text-background hover:opacity-90"
                      >
                        Update
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">{entry.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {entry.kind} · {entry.visibility}
                          {entry.pinned ? " · pinned" : ""} · {" "}
                          {new Date(entry.occurredAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(entry)}
                          className="rounded-lg border border-border px-3 py-1 text-xs hover:bg-muted"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteEntry(entry.id)}
                          className="rounded-lg border border-border px-3 py-1 text-xs hover:bg-muted"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {entry.body ? (
                      <p className="text-sm text-muted-foreground">{entry.body}</p>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No entries yet. Add your first milestone.
          </p>
        )}
      </div>
    </div>
  );
}
