"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DaoBlogIndex } from "@/modules/dao-blog/DaoBlogIndex";
import { supabaseBrowserClient } from "@/lib/supabase/client";

export default function DaoBlogPage() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [canAuthor, setCanAuthor] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadEntitlements = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          if (!cancelled) setCanAuthor(false);
          return;
        }

        const res = await fetch("/api/me/entitlements", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await res.json().catch(() => null)) as { entitlements?: string[] } | null;
        if (!cancelled) {
          setCanAuthor((json?.entitlements ?? []).includes("dao-member"));
        }
      } catch {
        if (!cancelled) setCanAuthor(false);
      }
    };

    void loadEntitlements();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      void loadEntitlements();
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">DAO Blog</h1>
          <p className="text-sm text-muted-foreground">
            Public updates, announcements, and thought pieces from RaidGuild.
          </p>
        </div>
        {canAuthor ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href="/modules/dao-blog/manage"
              className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
            >
              Manage posts
            </Link>
            <Link
              href="/modules/dao-blog/manage/new"
              className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
            >
              New post
            </Link>
          </div>
        ) : null}
      </div>
      <DaoBlogIndex />
    </div>
  );
}
