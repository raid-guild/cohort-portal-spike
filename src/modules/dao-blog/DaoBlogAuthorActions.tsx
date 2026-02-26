"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";

export function DaoBlogAuthorActions() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [canAuthor, setCanAuthor] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadAuthorAccess = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          if (!cancelled) setCanAuthor(false);
          return;
        }

        const res = await fetch("/api/modules/dao-blog/author-access", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await res.json().catch(() => null)) as { can_author?: boolean } | null;
        if (!cancelled) {
          setCanAuthor(Boolean(json?.can_author));
        }
      } catch {
        if (!cancelled) setCanAuthor(false);
      }
    };

    void loadAuthorAccess();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      void loadAuthorAccess();
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  if (!canAuthor) return null;

  return (
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
  );
}
