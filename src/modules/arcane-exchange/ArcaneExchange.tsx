"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type Listing = {
  id: string;
  type: "looking_for" | "offering";
  title: string;
  description: string;
  category: string | null;
  tags: string[] | null;
  status: "open" | "fulfilled" | "closed";
  created_by: string;
  contact_method: "profile" | "dm" | "external";
  external_contact: string | null;
  created_at: string;
  updated_at: string;
  fulfilled_at: string | null;
};

async function readJsonSafe<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function ArcaneExchange() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [token, setToken] = useState<string | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const isHost = roles.includes("host");

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [tagFilter, setTagFilter] = useState<string>("");

  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Listing | null>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");

  const [newType, setNewType] = useState<Listing["type"]>("looking_for");
  const [newTitle, setNewTitle] = useState<string>("");
  const [newDescription, setNewDescription] = useState<string>("");
  const [newCategory, setNewCategory] = useState<string>("");
  const [newTags, setNewTags] = useState<string>("");
  const [newContactMethod, setNewContactMethod] = useState<Listing["contact_method"]>("profile");
  const [newExternalContact, setNewExternalContact] = useState<string>("");

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

      try {
        const rolesRes = await fetch("/api/me/roles", {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });

        if (!rolesRes.ok) {
          if (!cancelled) setRoles([]);
          return;
        }

        const rolesJson = await rolesRes.json();
        if (!cancelled) setRoles(rolesJson.roles ?? []);
      } catch {
        if (!cancelled) setRoles([]);
      }
    };

    load();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      load();
      setSelectedId(null);
      setSelected(null);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  const loadListings = async (authToken: string) => {
    const params = new URLSearchParams();
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (categoryFilter.trim()) params.set("category", categoryFilter.trim());
    if (tagFilter.trim()) params.set("tag", tagFilter.trim());

    const res = await fetch(`/api/looking-for?${params.toString()}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const json = await readJsonSafe<{ listings?: Listing[]; error?: string }>(res);
    if (!res.ok) throw new Error(json?.error || `Failed to load listings (HTTP ${res.status}).`);
    setListings(json?.listings ?? []);
  };

  const loadDetail = async (authToken: string, id: string) => {
    const res = await fetch(`/api/looking-for/${id}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const json = await readJsonSafe<{ listing?: Listing; error?: string }>(res);
    if (!res.ok) throw new Error(json?.error || `Failed to load listing (HTTP ${res.status}).`);
    setSelected(json?.listing ?? null);
  };

  const refresh = async () => {
    if (!token) return;
    await loadListings(token);
    if (selectedId) await loadDetail(token, selectedId);
  };

  useEffect(() => {
    if (!token) return;
    setMessage("");
    setLoading(true);
    loadListings(token)
      .catch((error) => setMessage(error instanceof Error ? error.message : "Failed."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, typeFilter, statusFilter, categoryFilter, tagFilter]);

  const selectListing = async (id: string) => {
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
    const json = await readJsonSafe<{ error?: string }>(res);
    if (!res.ok) throw new Error(json?.error || `Request failed (HTTP ${res.status}).`);
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

  const createListing = async () => {
    const tags = newTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    await callPost("/api/looking-for", {
      type: newType,
      title: newTitle,
      description: newDescription,
      category: newCategory.trim() || null,
      tags,
      contact_method: newContactMethod,
      external_contact: newContactMethod === "external" ? newExternalContact.trim() || null : null,
    });

    setNewTitle("");
    setNewDescription("");
    setNewCategory("");
    setNewTags("");
    setNewExternalContact("");
  };

  if (!token) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">Sign in to view the Arcane Exchange.</p>
      </div>
    );
  }

  const canManageSelected = selected
    ? selected.created_by === viewerId || isHost
    : false;

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-sm font-medium">Filters</div>
          <div className="mt-3 grid gap-2">
            <div className="grid grid-cols-2 gap-2">
              <select
                className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="all">All types</option>
                <option value="looking_for">Looking for</option>
                <option value="offering">Offering</option>
              </select>
              <select
                className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All status</option>
                <option value="open">Open</option>
                <option value="fulfilled">Fulfilled</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <input
              className="h-9 rounded-md border border-border bg-background px-3 text-sm"
              placeholder="Category (e.g. dev)"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            />
            <input
              className="h-9 rounded-md border border-border bg-background px-3 text-sm"
              placeholder="Tag (single tag)"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-sm font-medium">Listings</div>
          <div className="mt-3 space-y-2">
            {listings.length ? (
              listings.map((row) => (
                <button
                  key={row.id}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    selectedId === row.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/40"
                  }`}
                  onClick={() => selectListing(row.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{row.title}</div>
                    <div className="text-[10px] text-muted-foreground">{row.type}</div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {row.status}
                    {row.category ? ` · ${row.category}` : ""}
                  </div>
                </button>
              ))
            ) : (
              <div className="text-xs text-muted-foreground">No listings found.</div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-sm font-medium">Create listing</div>
          <div className="mt-3 space-y-2">
            <select
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              value={newType}
              onChange={(e) => setNewType(e.target.value as Listing["type"])}
            >
              <option value="looking_for">Looking for</option>
              <option value="offering">Offering</option>
            </select>
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
              placeholder="Category (optional)"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
            <input
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
              placeholder="Tags (comma-separated)"
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
            />
            <select
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              value={newContactMethod}
              onChange={(e) => setNewContactMethod(e.target.value as Listing["contact_method"])}
            >
              <option value="profile">Contact via profile</option>
              <option value="dm">Contact via DM</option>
              <option value="external">External contact</option>
            </select>
            {newContactMethod === "external" ? (
              <input
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                placeholder="External contact (email/telegram/etc)"
                value={newExternalContact}
                onChange={(e) => setNewExternalContact(e.target.value)}
              />
            ) : null}
            <button
              className="h-9 w-full rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50"
              disabled={loading}
              onClick={() => runAction(createListing)}
            >
              Create
            </button>
          </div>
        </div>

        {message ? (
          <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            {message}
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        {!selected ? (
          <div className="text-sm text-muted-foreground">Select a listing to view details.</div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{selected.title}</h2>
                <div className="mt-1 text-xs text-muted-foreground">
                  {selected.type} · {selected.status}
                  {selected.category ? ` · ${selected.category}` : ""}
                </div>
              </div>
              {canManageSelected ? (
                <div className="flex flex-wrap gap-2">
                  {selected.status !== "fulfilled" ? (
                    <button
                      className="h-9 rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50"
                      disabled={loading}
                      onClick={() => runAction(() => callPost(`/api/looking-for/${selected.id}/fulfill`))}
                    >
                      Mark fulfilled
                    </button>
                  ) : null}
                  {selected.status !== "closed" ? (
                    <button
                      className="h-9 rounded-md border border-border px-3 text-sm disabled:opacity-50"
                      disabled={loading}
                      onClick={() => runAction(() => callPost(`/api/looking-for/${selected.id}/close`))}
                    >
                      Close
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{selected.description}</p>

            <div className="text-xs text-muted-foreground">
              <div>Author: {selected.created_by.slice(0, 8)}</div>
              <div>
                Tags: {(selected.tags ?? []).length ? (selected.tags ?? []).join(", ") : "(none)"}
              </div>
              <div>
                Contact: {selected.contact_method}
                {selected.contact_method === "external" && selected.external_contact
                  ? ` (${selected.external_contact})`
                  : ""}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
