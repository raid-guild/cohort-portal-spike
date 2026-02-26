"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
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
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
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
  const [viewMode, setViewMode] = useState<"edit" | "split" | "preview">("split");

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

  function insertText(before: string, after = "", placeholder = "") {
    const target = bodyRef.current;
    if (!target) return;

    const start = target.selectionStart ?? 0;
    const end = target.selectionEnd ?? start;
    const selection = bodyMd.slice(start, end);
    const content = selection || placeholder;
    const next = `${bodyMd.slice(0, start)}${before}${content}${after}${bodyMd.slice(end)}`;
    setBodyMd(next);

    requestAnimationFrame(() => {
      target.focus();
      const cursor = start + before.length + content.length;
      target.setSelectionRange(cursor, cursor);
    });
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm">Body (markdown)</span>
          <div className="flex flex-wrap gap-1 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("edit")}
              className={`rounded border px-2 py-1 ${viewMode === "edit" ? "border-foreground" : "border-border hover:bg-muted"}`}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setViewMode("split")}
              className={`rounded border px-2 py-1 ${viewMode === "split" ? "border-foreground" : "border-border hover:bg-muted"}`}
            >
              Split
            </button>
            <button
              type="button"
              onClick={() => setViewMode("preview")}
              className={`rounded border px-2 py-1 ${viewMode === "preview" ? "border-foreground" : "border-border hover:bg-muted"}`}
            >
              Preview
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 rounded border border-border bg-card p-2 text-xs">
          <button type="button" onClick={() => insertText("# ", "", "Heading")} className="rounded border border-border px-2 py-1 hover:bg-muted">
            H1
          </button>
          <button type="button" onClick={() => insertText("## ", "", "Heading")} className="rounded border border-border px-2 py-1 hover:bg-muted">
            H2
          </button>
          <button type="button" onClick={() => insertText("**", "**", "bold")} className="rounded border border-border px-2 py-1 hover:bg-muted">
            Bold
          </button>
          <button type="button" onClick={() => insertText("*", "*", "italic")} className="rounded border border-border px-2 py-1 hover:bg-muted">
            Italic
          </button>
          <button type="button" onClick={() => insertText("[", "](https://example.com)", "link text")} className="rounded border border-border px-2 py-1 hover:bg-muted">
            Link
          </button>
          <button type="button" onClick={() => insertText("\n- ", "", "List item")} className="rounded border border-border px-2 py-1 hover:bg-muted">
            List
          </button>
          <button type="button" onClick={() => insertText("\n> ", "", "Quote")} className="rounded border border-border px-2 py-1 hover:bg-muted">
            Quote
          </button>
          <button type="button" onClick={() => insertText("`", "`", "inline code")} className="rounded border border-border px-2 py-1 hover:bg-muted">
            Code
          </button>
          <button
            type="button"
            onClick={() => insertText("\n```\n", "\n```\n", "code block")}
            className="rounded border border-border px-2 py-1 hover:bg-muted"
          >
            Code block
          </button>
          <button type="button" onClick={() => insertText("\n---\n")} className="rounded border border-border px-2 py-1 hover:bg-muted">
            Divider
          </button>
        </div>

        <div className={`grid gap-3 ${viewMode === "split" ? "md:grid-cols-2" : ""}`}>
          {viewMode !== "preview" ? (
            <textarea
              ref={bodyRef}
              value={bodyMd}
              onChange={(event) => setBodyMd(event.target.value)}
              className="min-h-72 w-full rounded border border-border bg-background px-3 py-2 font-mono text-sm"
            />
          ) : null}
          {viewMode !== "edit" ? (
            <div className="min-h-72 rounded border border-border bg-card p-3">
              {bodyMd.trim() ? (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{bodyMd}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Markdown preview will appear here.</p>
              )}
            </div>
          ) : null}
        </div>
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
