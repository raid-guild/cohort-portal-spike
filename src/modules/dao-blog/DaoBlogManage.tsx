"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type Post = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "in_review" | "published";
  updated_at: string;
  review_notes: string | null;
};

export function DaoBlogManage() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [token, setToken] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const nextToken = data.session?.access_token ?? null;
      if (!nextToken) {
        throw new Error("You must be signed in to manage posts.");
      }
      setToken(nextToken);

      const res = await fetch("/api/modules/dao-blog/manage", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${nextToken}` },
      });
      const json = (await res.json()) as { posts?: Post[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to load posts.");
      setPosts(json.posts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load posts.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function transition(id: string, action: "submit-review" | "approve" | "reject" | "unpublish") {
    if (!token) return;
    setError(null);
    const body = action === "reject" ? { review_notes: "Needs revision before publish." } : undefined;
    const res = await fetch(`/api/modules/dao-blog/posts/${id}/${action}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(json.error || `Failed to ${action}.`);
      return;
    }
    await load();
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading posts...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Create drafts, submit for host review, and manage publication state.</p>
        <Link
          href="/modules/dao-blog/manage/new"
          className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
        >
          New post
        </Link>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!posts.length ? <p className="text-sm text-muted-foreground">No posts yet.</p> : null}

      <div className="space-y-3">
        {posts.map((post) => (
          <div key={post.id} className="space-y-2 rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">{post.title}</h3>
                <p className="text-xs text-muted-foreground">
                  {post.status} · updated {new Date(post.updated_at).toLocaleString("en-US")}
                </p>
              </div>
              <Link
                href={`/modules/dao-blog/manage/${post.id}`}
                className="rounded-lg border border-border px-3 py-1 text-xs hover:bg-muted"
              >
                Edit
              </Link>
            </div>

            {post.review_notes ? (
              <p className="text-xs text-amber-700">Review notes: {post.review_notes}</p>
            ) : null}

            <div className="flex flex-wrap gap-2 text-xs">
              {post.status === "draft" ? (
                <button
                  onClick={() => transition(post.id, "submit-review")}
                  className="rounded border border-border px-2 py-1 hover:bg-muted"
                >
                  Submit review
                </button>
              ) : null}
              {post.status === "in_review" ? (
                <>
                  <button
                    onClick={() => transition(post.id, "approve")}
                    className="rounded border border-border px-2 py-1 hover:bg-muted"
                  >
                    Approve (host)
                  </button>
                  <button
                    onClick={() => transition(post.id, "reject")}
                    className="rounded border border-border px-2 py-1 hover:bg-muted"
                  >
                    Reject (host)
                  </button>
                </>
              ) : null}
              {post.status === "published" ? (
                <button
                  onClick={() => transition(post.id, "unpublish")}
                  className="rounded border border-border px-2 py-1 hover:bg-muted"
                >
                  Unpublish (host)
                </button>
              ) : null}
              <Link href={`/modules/dao-blog/${post.slug}`} className="rounded border border-border px-2 py-1 hover:bg-muted">
                View permalink
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
