"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type ShowcasePost = {
  id: string;
  user_id: string;
  image_url: string;
  title: string;
  impact_statement: string;
  boost_count: number;
  created_at: string;
};

export function RaidShowcaseFeed() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [posts, setPosts] = useState<ShowcasePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [impact, setImpact] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/modules/raid-showcase", { cache: "no-store" });
      const json = (await res.json()) as { posts?: ShowcasePost[]; error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to load feed.");
      }
      setPosts(json.posts ?? []);
    } catch (err) {
      setPosts([]);
      setError(err instanceof Error ? err.message : "Failed to load feed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (accessToken: string | null | undefined) => {
    if (!accessToken) {
      setError("You must be signed in to post.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("title", title);
      formData.set("impact_statement", impact);
      if (file) {
        formData.set("file", file);
      }

      const res = await fetch("/api/modules/raid-showcase", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });

      const json = (await res.json()) as { post?: ShowcasePost; error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to submit post.");
      }

      setTitle("");
      setImpact("");
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit post.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-sm font-semibold">Share a win</div>
        <div className="mt-3 grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-xs text-muted-foreground">Title (max 100)</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              className="h-10 rounded-lg border border-border bg-background px-3"
              placeholder="What did you ship today?"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-xs text-muted-foreground">
              Impact statement (max 280)
            </span>
            <textarea
              value={impact}
              onChange={(e) => setImpact(e.target.value)}
              maxLength={280}
              className="min-h-24 rounded-lg border border-border bg-background p-3"
              placeholder="Why does it matter? Who benefits?"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-xs text-muted-foreground">Image upload</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={async () => {
                try {
                  const { data } = await supabase.auth.getSession();
                  await submit(data.session?.access_token);
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Failed to read your session.",
                  );
                }
              }}
              disabled={saving}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {saving ? "Posting..." : "Post win"}
            </button>
            <button
              type="button"
              onClick={() => load()}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm hover:bg-muted"
            >
              Refresh
            </button>
          </div>

          {error ? <div className="text-sm text-red-500">{error}</div> : null}
        </div>
      </div>

      <div>
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold">Latest wins</h2>
            <p className="text-sm text-muted-foreground">
              Proof-of-work posts from cohort members.
            </p>
          </div>
        </div>

        {loading && !posts.length ? (
          <div className="mt-3 text-sm text-muted-foreground">Loading feed...</div>
        ) : null}

        {!loading && !posts.length ? (
          <div className="mt-3 text-sm text-muted-foreground">
            No wins yet. Be the first to post.
          </div>
        ) : null}

        {posts.length ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <div
                key={post.id}
                className="overflow-hidden rounded-xl border border-border bg-card"
              >
                <div className="aspect-[4/3] w-full bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.image_url}
                    alt={post.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="space-y-2 p-4">
                  <div className="text-sm font-semibold">{post.title}</div>
                  <p className="text-sm text-muted-foreground">
                    {post.impact_statement}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Boosts: {post.boost_count}</span>
                    <span>{new Date(post.created_at).toLocaleDateString()}</span>
                  </div>
                  <button
                    type="button"
                    disabled
                    className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-border text-sm text-muted-foreground"
                    title="Boost is coming in a follow-up."
                  >
                    Boost
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
