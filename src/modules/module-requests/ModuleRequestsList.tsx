"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import type { ModuleRequest } from "./types";

type Sort = "new" | "trending" | "ready";

export function ModuleRequestsList() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);

  const [requests, setRequests] = useState<ModuleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("new");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        setRequests([]);
        setError("You must be signed in to view module requests.");
        return;
      }

      const res = await fetch(`/api/modules/module-requests?sort=${sort}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = (await res.json()) as { requests?: ModuleRequest[]; error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to load requests.");
      }
      setRequests(json.requests ?? []);
    } catch (err) {
      setRequests([]);
      setError(err instanceof Error ? err.message : "Failed to load requests.");
    } finally {
      setLoading(false);
    }
  }, [sort, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSort("new")}
            className={`h-9 rounded-lg border border-border px-3 text-sm ${
              sort === "new" ? "bg-muted" : "hover:bg-muted"
            }`}
          >
            New
          </button>
          <button
            type="button"
            onClick={() => setSort("trending")}
            className={`h-9 rounded-lg border border-border px-3 text-sm ${
              sort === "trending" ? "bg-muted" : "hover:bg-muted"
            }`}
          >
            Trending
          </button>
          <button
            type="button"
            onClick={() => setSort("ready")}
            className={`h-9 rounded-lg border border-border px-3 text-sm ${
              sort === "ready" ? "bg-muted" : "hover:bg-muted"
            }`}
          >
            Ready
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/modules/module-requests/new"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
          >
            New request
          </Link>
          <button
            type="button"
            onClick={() => load()}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-border px-3 text-sm hover:bg-muted"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? <div className="text-sm text-red-500">{error}</div> : null}

      {loading && !requests.length ? (
        <div className="text-sm text-muted-foreground">Loading requests...</div>
      ) : null}

      {!loading && !requests.length ? (
        <div className="text-sm text-muted-foreground">No requests found.</div>
      ) : null}

      {requests.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {requests.map((req) => (
            <Link
              key={req.id}
              href={`/modules/module-requests/${req.id}`}
              className="rounded-xl border border-border bg-card p-4 hover:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{req.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {req.module_id}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{req.status}</div>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Votes: {req.votes_count} / {req.promotion_threshold}
                </span>
                <span>{new Date(req.created_at).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
