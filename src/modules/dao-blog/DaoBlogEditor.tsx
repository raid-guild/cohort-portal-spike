"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type Post = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  header_image_url: string;
  body_md: string;
  status: "draft" | "in_review" | "published";
};

function toKebabCase(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function DaoBlogEditor({ postId }: { postId?: string }) {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(postId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [summary, setSummary] = useState("");
  const [headerImageUrl, setHeaderImageUrl] = useState("");
  const [bodyMd, setBodyMd] = useState("");

  const load = useCallback(async () => {
    setLoading(Boolean(postId));
    setError(null);
    setStatus(null);
    try {
      const { data } = await supabase.auth.getSession();
      const nextToken = data.session?.access_token;
      if (!nextToken) {
        throw new Error("You must be signed in to edit posts.");
      }
      setToken(nextToken);

      if (!postId) return;

      const res = await fetch(`/api/modules/dao-blog/manage/${postId}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${nextToken}` },
      });
      const json = (await res.json()) as { post?: Post; error?: string };
      if (!res.ok || !json.post) {
        throw new Error(json.error || "Failed to load post.");
      }

      setTitle(json.post.title);
      setSlug(json.post.slug);
      setSummary(json.post.summary);
      setHeaderImageUrl(json.post.header_image_url);
      setBodyMd(json.post.body_md);
      setStatus(json.post.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load post.");
    } finally {
      setLoading(false);
    }
  }, [postId, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!token) return;

    setSaving(true);
    setError(null);
    try {
      const payload = {
        title,
        slug: postId ? slug : toKebabCase(slug || title),
        summary,
        header_image_url: headerImageUrl,
        body_md: bodyMd,
      };

      const endpoint = postId ? `/api/modules/dao-blog/posts/${postId}` : "/api/modules/dao-blog/posts";
      const method = postId ? "PATCH" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { post?: Post; error?: string };
      if (!res.ok || !json.post) {
        throw new Error(json.error || "Failed to save post.");
      }

      setStatus(json.post.status);
      if (!postId) {
        window.location.href = `/modules/dao-blog/manage/${json.post.id}`;
        return;
      }
      setStatus(`${json.post.status} (saved)`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save post.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading editor...</p>;
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {status ? <p className="text-sm text-muted-foreground">Status: {status}</p> : null}

      <label className="block space-y-1">
        <span className="text-sm">Title</span>
        <input
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (!postId) setSlug(toKebabCase(event.target.value));
          }}
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
          placeholder="DAO update title"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm">Slug{postId ? " (immutable)" : ""}</span>
        <input
          value={slug}
          onChange={(event) => setSlug(toKebabCase(event.target.value))}
          disabled={Boolean(postId)}
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          placeholder="dao-update-title"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm">Summary (max 280 chars)</span>
        <textarea
          value={summary}
          onChange={(event) => setSummary(event.target.value.slice(0, 280))}
          className="min-h-20 w-full rounded border border-border bg-background px-3 py-2 text-sm"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm">Header image URL</span>
        <input
          value={headerImageUrl}
          onChange={(event) => setHeaderImageUrl(event.target.value)}
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
          placeholder="https://..."
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm">Body (markdown)</span>
        <textarea
          value={bodyMd}
          onChange={(event) => setBodyMd(event.target.value)}
          className="min-h-56 w-full rounded border border-border bg-background px-3 py-2 font-mono text-sm"
        />
      </label>

      <button
        disabled={saving}
        onClick={save}
        className="rounded border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save draft"}
      </button>
    </div>
  );
}
