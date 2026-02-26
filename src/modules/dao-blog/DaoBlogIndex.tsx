"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

type Post = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  header_image_url: string;
  published_at: string | null;
};

export function DaoBlogIndex() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/modules/dao-blog/posts", { cache: "no-store" });
        const json = (await res.json()) as { posts?: Post[]; error?: string };
        if (!res.ok) {
          throw new Error(json.error || "Failed to load posts.");
        }
        if (!cancelled) {
          setPosts(json.posts ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load posts.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading posts...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!posts.length) {
    return <p className="text-sm text-muted-foreground">No published posts yet.</p>;
  }

  return (
    <div className="grid gap-6">
      {posts.map((post) => (
        <article key={post.id} className="overflow-hidden rounded-xl border border-border bg-card">
          <Image
            src={post.header_image_url}
            alt={post.title}
            className="h-52 w-full object-cover"
            width={1200}
            height={630}
            loading="lazy"
          />
          <div className="space-y-3 p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {post.published_at ? new Date(post.published_at).toLocaleDateString("en-US") : "Draft"}
            </p>
            <h2 className="text-2xl font-semibold">
              <Link className="hover:underline" href={`/modules/dao-blog/${post.slug}`}>
                {post.title}
              </Link>
            </h2>
            <p className="text-sm text-muted-foreground">{post.summary}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
