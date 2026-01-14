"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type Announcement = {
  id: string;
  title: string;
  body: string;
  starts_at: string | null;
  ends_at: string | null;
  audience: string;
  role_targets: string[] | null;
};

export function AnnouncementsList() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadAnnouncements = async (token?: string | null) => {
      setLoading(true);
      try {
        const res = await fetch("/api/announcements", {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const json = await res.json();
        if (!cancelled) {
          setItems(json.announcements ?? []);
        }
      } catch {
        if (!cancelled) {
          setItems([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      loadAnnouncements(data.session?.access_token);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        loadAnnouncements(session?.access_token);
      },
    );

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  if (loading && !items.length) {
    return (
      <div className="text-sm text-muted-foreground">Loading announcements...</div>
    );
  }

  if (!items.length) {
    return (
      <div className="text-sm text-muted-foreground">
        No announcements yet.
      </div>
    );
  }

  return (
    <ul className="space-y-3 text-sm text-muted-foreground">
      {items.map((item) => (
        <li key={item.id} className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm font-semibold text-foreground">
            {item.title}
          </div>
          <p className="mt-2 text-sm">{item.body}</p>
        </li>
      ))}
    </ul>
  );
}
