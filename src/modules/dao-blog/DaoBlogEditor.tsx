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

const ALLOWED_HEADER_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_HEADER_IMAGE_BYTES = 5 * 1024 * 1024;

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
  const localHeaderImagePreviewRef = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(postId));
  const [saving, setSaving] = useState(false);
  const [uploadingHeaderImage, setUploadingHeaderImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [summary, setSummary] = useState("");
  const [headerImageUrl, setHeaderImageUrl] = useState("");
  const [headerImagePreviewUrl, setHeaderImagePreviewUrl] = useState<string | null>(null);
  const [headerImageMimeType, setHeaderImageMimeType] = useState<string | null>(null);
  const [headerImageSizeBytes, setHeaderImageSizeBytes] = useState<number | null>(null);
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
      setHeaderImagePreviewUrl(json.post.header_image_url);
      setHeaderImageMimeType(null);
      setHeaderImageSizeBytes(null);
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

  useEffect(
    () => () => {
      if (localHeaderImagePreviewRef.current) {
        URL.revokeObjectURL(localHeaderImagePreviewRef.current);
        localHeaderImagePreviewRef.current = null;
      }
    },
    [],
  );

  async function uploadHeaderImage(file: File) {
    if (!token) {
      setError("You must be signed in to upload a header image.");
      return;
    }

    if (!ALLOWED_HEADER_IMAGE_MIME_TYPES.has(file.type)) {
      setError("Header image must be JPEG, PNG, or WebP.");
      return;
    }

    if (file.size > MAX_HEADER_IMAGE_BYTES) {
      setError("Header image must be 5MB or smaller.");
      return;
    }

    setUploadingHeaderImage(true);
    setError(null);
    setStatus(null);
    const previousUrl = headerImageUrl;
    const previousPreviewUrl = headerImagePreviewUrl;

    try {
      if (localHeaderImagePreviewRef.current) {
        URL.revokeObjectURL(localHeaderImagePreviewRef.current);
        localHeaderImagePreviewRef.current = null;
      }

      const localPreview = URL.createObjectURL(file);
      localHeaderImagePreviewRef.current = localPreview;
      setHeaderImagePreviewUrl(localPreview);

      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/modules/dao-blog/header-image", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const json = (await res.json()) as {
        url?: string;
        mime_type?: string;
        size_bytes?: number;
        error?: string;
      };
      if (!res.ok || !json.url) {
        throw new Error(json.error || "Failed to upload header image.");
      }

      if (localHeaderImagePreviewRef.current) {
        URL.revokeObjectURL(localHeaderImagePreviewRef.current);
        localHeaderImagePreviewRef.current = null;
      }

      setHeaderImageUrl(json.url);
      setHeaderImagePreviewUrl(json.url);
      setHeaderImageMimeType(json.mime_type ?? file.type);
      setHeaderImageSizeBytes(
        typeof json.size_bytes === "number" && Number.isFinite(json.size_bytes)
          ? json.size_bytes
          : file.size,
      );
      setStatus("Header image uploaded.");
    } catch (err) {
      if (localHeaderImagePreviewRef.current) {
        URL.revokeObjectURL(localHeaderImagePreviewRef.current);
        localHeaderImagePreviewRef.current = null;
      }
      setHeaderImageUrl(previousUrl);
      setHeaderImagePreviewUrl(previousPreviewUrl);
      setError(err instanceof Error ? err.message : "Failed to upload header image.");
    } finally {
      setUploadingHeaderImage(false);
    }
  }

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
        header_image_mime_type: headerImageMimeType,
        header_image_size_bytes: headerImageSizeBytes,
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

  const headerImagePreviewSrc = headerImagePreviewUrl?.trim() || headerImageUrl.trim() || null;

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

      <div className="space-y-2">
        <div className="text-sm">Header image</div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer rounded border border-border px-3 py-2 text-xs hover:bg-muted">
            {uploadingHeaderImage ? "Uploading..." : "Upload image"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={uploadingHeaderImage}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadHeaderImage(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
          <span className="text-xs text-muted-foreground">JPEG, PNG, or WebP. Max 5MB.</span>
        </div>
        {headerImagePreviewSrc ? (
          <img
            src={headerImagePreviewSrc}
            alt="Header preview"
            className="h-auto w-full max-w-xl rounded border border-border object-cover"
          />
        ) : (
          <p className="text-xs text-muted-foreground">Upload a header image to continue.</p>
        )}
      </div>

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
              {headerImagePreviewSrc ? (
                <img
                  src={headerImagePreviewSrc}
                  alt={title || "Draft header image"}
                  className="mb-4 h-auto w-full rounded border border-border object-cover"
                />
              ) : null}
              {summary.trim() ? <p className="mb-4 text-sm text-muted-foreground">{summary.trim()}</p> : null}
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
        disabled={saving || uploadingHeaderImage}
        onClick={save}
        className="rounded border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-60"
      >
        {saving ? "Saving..." : uploadingHeaderImage ? "Uploading image..." : "Save draft"}
      </button>
    </div>
  );
}
