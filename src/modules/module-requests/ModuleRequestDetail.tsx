"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { HostOnly } from "@/components/HostOnly";
import type { ModuleRequest } from "./types";

export function ModuleRequestDetail({ id }: { id: string }) {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const router = useRouter();

  const [request, setRequest] = useState<ModuleRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [githubUrl, setGithubUrl] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        setRequest(null);
        setError("You must be signed in to view this request.");
        return;
      }

      const res = await fetch(`/api/modules/module-requests/${id}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = (await res.json()) as { request?: ModuleRequest; error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to load request.");
      }
      setRequest(json.request ?? null);
    } catch (err) {
      setRequest(null);
      setError(err instanceof Error ? err.message : "Failed to load request.");
    } finally {
      setLoading(false);
    }
  }, [id, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const call = async (path: string, init?: RequestInit) => {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      throw new Error("You must be signed in.");
    }

    const res = await fetch(path, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init?.headers ?? {}),
      },
    });

    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(typeof json.error === "string" ? json.error : "Request failed.");
    }
    return json;
  };

  const publish = async () => {
    setSaving(true);
    setError(null);
    try {
      await call(`/api/modules/module-requests/${id}/publish`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish.");
    } finally {
      setSaving(false);
    }
  };

  const vote = async () => {
    setSaving(true);
    setError(null);
    try {
      await call(`/api/modules/module-requests/${id}/vote`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to vote.");
    } finally {
      setSaving(false);
    }
  };

  const unvote = async () => {
    setSaving(true);
    setError(null);
    try {
      await call(`/api/modules/module-requests/${id}/vote`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unvote.");
    } finally {
      setSaving(false);
    }
  };

  const promote = async (withLink: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const json = (await call(`/api/modules/module-requests/${id}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ github_issue_url: withLink ? githubUrl : undefined }),
      })) as { markdown?: string; request?: ModuleRequest };

      setMarkdown(typeof json.markdown === "string" ? json.markdown : null);
      if (json.request) {
        setRequest(json.request);
      } else {
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to promote.");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !request) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  if (!request) {
    return (
      <div className="space-y-2">
        <Link
          href="/modules/module-requests"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back
        </Link>
        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          {error ?? "Not found."}
        </div>
      </div>
    );
  }

  const spec = request.spec ?? {};

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/modules/module-requests"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back
        </Link>
        <button
          type="button"
          onClick={() => {
            router.refresh();
            load();
          }}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-border px-3 text-sm hover:bg-muted"
        >
          Refresh
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{request.title}</h1>
            <div className="mt-1 text-sm text-muted-foreground">
              <span className="font-mono">{request.module_id}</span> · {request.status}
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Votes: {request.votes_count} / {request.promotion_threshold}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {request.status === "draft" ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => publish()}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              Publish
            </button>
          ) : null}

          <button
            type="button"
            disabled={saving}
            onClick={() => vote()}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm hover:bg-muted disabled:opacity-60"
          >
            Vote
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => unvote()}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm hover:bg-muted disabled:opacity-60"
          >
            Unvote
          </button>

          {request.github_issue_url ? (
            <a
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm hover:bg-muted"
              href={request.github_issue_url}
              target="_blank"
              rel="noreferrer"
            >
              View GitHub issue
            </a>
          ) : null}
        </div>

        {error ? <div className="mt-3 text-sm text-red-500">{error}</div> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SpecCard title="Problem / user value" value={readSpec(spec, "problem")} />
        <SpecCard title="Scope (what’s in / out)" value={readSpec(spec, "scope")} />
        <SpecCard title="UX / surfaces" value={readSpec(spec, "ux")} />
        <SpecCard title="Storage preference" value={readSpec(spec, "storage")} />
        <SpecCard title="Data model" value={readSpec(spec, "data_model")} />
        <SpecCard title="API requirements" value={readSpec(spec, "api")} />
        <SpecCard title="Acceptance criteria" value={readSpec(spec, "acceptance")} />
        <SpecCard title="Testing / seed data" value={readSpec(spec, "testing")} />
        <SpecCard title="Portal RPC (optional)" value={readSpec(spec, "portal_rpc")} />
        <SpecCard
          title="Allowed iframe origins (optional)"
          value={readSpec(spec, "allowed_origins")}
        />
      </div>

      <HostOnly
        fallback={
          request.status === "ready" ? (
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              Ready for GitHub. Host access required to promote.
            </div>
          ) : null
        }
      >
        {request.status === "ready" || request.status === "open" ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm font-semibold">Promote to GitHub</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Generate a GitHub-ready issue body. Optionally paste the created GitHub issue URL to mark as submitted.
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => promote(false)}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm hover:bg-muted disabled:opacity-60"
              >
                Generate markdown
              </button>
              <input
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                className="h-10 min-w-64 flex-1 rounded-lg border border-border bg-background px-3 text-sm"
                placeholder="https://github.com/org/repo/issues/123"
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => promote(true)}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                Store link
              </button>
            </div>

            {markdown ? (
              <div className="mt-3">
                <div className="text-xs text-muted-foreground">Markdown</div>
                <textarea
                  value={markdown}
                  readOnly
                  className="mt-1 min-h-56 w-full rounded-lg border border-border bg-background p-3 font-mono text-xs"
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </HostOnly>
    </div>
  );
}

function readSpec(spec: Record<string, unknown>, key: string): string {
  const raw = spec[key];
  if (typeof raw !== "string") return "";
  return raw;
}

function SpecCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-sm font-semibold">{title}</div>
      {value ? (
        <pre className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
          {value}
        </pre>
      ) : (
        <div className="mt-2 text-sm text-muted-foreground">—</div>
      )}
    </div>
  );
}
