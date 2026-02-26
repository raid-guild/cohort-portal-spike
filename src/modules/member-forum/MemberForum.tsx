"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { MarkdownEditor } from "@/modules/_shared/MarkdownEditor";
import { MarkdownRenderer } from "@/modules/_shared/MarkdownRenderer";

type Space = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  read_level: "public" | "member" | "cohort";
  write_level: "member" | "cohort";
  can_write: boolean;
};

type Post = {
  id: string;
  space_id: string;
  author_id: string;
  title: string;
  body_md: string;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
  space: {
    id: string;
    slug: string;
    name: string;
  } | null;
};

type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  parent_comment_id: string | null;
  body_md: string;
  created_at: string;
};

type ViewMode = "feed" | "space" | "post" | "new";

export function MemberForum({
  mode = "feed",
  spaceSlug,
  postId,
}: {
  mode?: ViewMode;
  spaceSlug?: string;
  postId?: string;
}) {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [title, setTitle] = useState("");
  const [bodyMd, setBodyMd] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [selectedSpace, setSelectedSpace] = useState(spaceSlug ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getAuthHeader = useCallback(async (): Promise<Record<string, string>> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [supabase]);

  useEffect(() => {
    if (spaceSlug) setSelectedSpace(spaceSlug);
  }, [spaceSlug]);

  useEffect(() => {
    let cancelled = false;
    async function loadSpaces() {
      setLoading(true);
      setError(null);
      try {
        const headers = await getAuthHeader();
        const res = await fetch("/api/modules/member-forum/spaces", {
          cache: "no-store",
          headers,
        });
        const json = (await res.json()) as { spaces?: Space[]; error?: string };
        if (!res.ok) throw new Error(json.error || "Failed to load spaces.");
        if (!cancelled) {
          const loadedSpaces = json.spaces ?? [];
          setSpaces(loadedSpaces);
          if (!selectedSpace && loadedSpaces.length > 0 && mode !== "post") {
            setSelectedSpace(loadedSpaces[0]!.slug);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load spaces.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadSpaces();
    return () => {
      cancelled = true;
    };
  }, [getAuthHeader, mode, selectedSpace]);

  useEffect(() => {
    if (mode === "post" && postId) {
      let cancelled = false;
      async function loadPost() {
        setLoading(true);
        setError(null);
        try {
          const headers = await getAuthHeader();
          const res = await fetch(`/api/modules/member-forum/posts/${postId}`, {
            cache: "no-store",
            headers,
          });
          const json = (await res.json()) as {
            post?: Post;
            comments?: Comment[];
            error?: string;
          };
          if (!res.ok) throw new Error(json.error || "Failed to load post.");
          if (!cancelled) {
            setPost(json.post ?? null);
            setComments(json.comments ?? []);
          }
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Failed to load post.");
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
      void loadPost();
      return () => {
        cancelled = true;
      };
    }

    if (mode === "feed" || mode === "space" || mode === "new") {
      let cancelled = false;
      async function loadPosts() {
        setLoading(true);
        setError(null);
        try {
          const headers = await getAuthHeader();
          const params = new URLSearchParams();
          if (mode !== "feed" && selectedSpace) {
            params.set("space", selectedSpace);
          }
          const qs = params.toString();
          const res = await fetch(`/api/modules/member-forum/posts${qs ? `?${qs}` : ""}`, {
            cache: "no-store",
            headers,
          });
          const json = (await res.json()) as { posts?: Post[]; error?: string };
          if (!res.ok) throw new Error(json.error || "Failed to load posts.");
          if (!cancelled) setPosts(json.posts ?? []);
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Failed to load posts.");
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
      void loadPosts();
      return () => {
        cancelled = true;
      };
    }
  }, [getAuthHeader, mode, postId, selectedSpace]);

  const selectedSpaceMeta = spaces.find((space) => space.slug === selectedSpace) ?? null;

  async function submitPost(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!title.trim() || !bodyMd.trim()) {
      setError("Title and body are required.");
      return;
    }
    try {
      const headers = await getAuthHeader();
      const res = await fetch("/api/modules/member-forum/posts", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          space_slug: selectedSpace,
          title,
          body_md: bodyMd,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to create post.");
      window.location.href = `/modules/member-forum/s/${encodeURIComponent(selectedSpace)}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create post.");
    }
  }

  async function submitComment(event: React.FormEvent) {
    event.preventDefault();
    if (!post) return;
    setError(null);
    if (!commentBody.trim()) {
      setError("Comment body is required.");
      return;
    }
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`/api/modules/member-forum/posts/${post.id}/comments`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body_md: commentBody }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to create comment.");
      setCommentBody("");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create comment.");
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading forum…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (mode === "post") {
    return (
      <div className="space-y-4">
        {!post ? <p className="text-sm text-muted-foreground">Post not found.</p> : null}
        {post ? (
          <>
            <article className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">/{post.space?.slug ?? "space"}</p>
              <h2 className="mt-1 text-xl font-semibold">{post.title}</h2>
              <div className="mt-2">
                <MarkdownRenderer markdown={post.body_md} />
              </div>
              {post.is_locked ? (
                <p className="mt-3 text-xs text-muted-foreground">This thread is locked.</p>
              ) : null}
            </article>

            <section className="space-y-3">
              <h3 className="text-lg font-medium">Comments</h3>
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-lg border border-border bg-card p-3">
                  <MarkdownRenderer markdown={comment.body_md} />
                </div>
              ))}
              {!comments.length ? (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              ) : null}
            </section>

            {!post.is_locked ? (
              <form onSubmit={submitComment} className="space-y-2 rounded-xl border border-border bg-card p-4">
                <label className="block text-sm font-medium">Add comment</label>
                <MarkdownEditor
                  value={commentBody}
                  onChange={setCommentBody}
                  minHeightClassName="min-h-24"
                  placeholder="Write a reply in markdown"
                />
                <button type="submit" className="rounded-md border border-border px-3 py-2 text-sm">
                  Comment
                </button>
              </form>
            ) : null}
          </>
        ) : null}
      </div>
    );
  }

  if (mode === "new") {
    return (
      <div className="space-y-4">
        <form onSubmit={submitPost} className="space-y-3 rounded-xl border border-border bg-card p-4">
          <label className="block text-sm font-medium" htmlFor="forum-space">
            Space
          </label>
          <select
            id="forum-space"
            value={selectedSpace}
            onChange={(event) => setSelectedSpace(event.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            required
          >
            {spaces.map((space) => (
              <option key={space.id} value={space.slug}>
                {space.name} (/{space.slug})
              </option>
            ))}
          </select>
          {!selectedSpaceMeta?.can_write ? (
            <p className="text-xs text-muted-foreground">You do not have write access to this space.</p>
          ) : null}

          <label className="block text-sm font-medium" htmlFor="forum-title">
            Title
          </label>
          <input
            id="forum-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            required
          />

          <label className="block text-sm font-medium" htmlFor="forum-body">
            Body (markdown)
          </label>
          <MarkdownEditor
            value={bodyMd}
            onChange={setBodyMd}
            minHeightClassName="min-h-32"
            placeholder="Write your post in markdown..."
          />

          <button
            type="submit"
            disabled={!selectedSpaceMeta?.can_write}
            className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-50"
          >
            Create post
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {spaces.map((space) => (
          <a
            key={space.id}
            href={`/modules/member-forum/s/${encodeURIComponent(space.slug)}`}
            className={`rounded-md border px-3 py-1 text-xs ${
              selectedSpace === space.slug ? "border-foreground" : "border-border"
            }`}
          >
            /{space.slug}
          </a>
        ))}
      </div>

      <div className="flex gap-2">
        <a
          href={`/modules/member-forum/new${selectedSpace ? `?space=${encodeURIComponent(selectedSpace)}` : ""}`}
          className="rounded-md border border-border px-3 py-2 text-sm"
        >
          New post
        </a>
      </div>

      <section className="space-y-3">
        {posts.map((item) => (
          <article key={item.id} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">/{item.space?.slug ?? "space"}</p>
            <a href={`/modules/member-forum/p/${item.id}`} className="mt-1 block text-lg font-semibold">
              {item.title}
            </a>
            <div className="mt-2 text-muted-foreground">
              <MarkdownRenderer markdown={item.body_md} className="space-y-2 text-sm leading-6" />
            </div>
          </article>
        ))}
        {!posts.length ? (
          <p className="text-sm text-muted-foreground">No posts available in this view.</p>
        ) : null}
      </section>
    </div>
  );
}
