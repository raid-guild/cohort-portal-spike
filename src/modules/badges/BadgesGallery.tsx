"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Badge = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
};

export function BadgesGallery() {
  const [badges, setBadges] = useState<Badge[] | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setError("");
      try {
        const res = await fetch("/api/badges");
        const json = await res.json();
        if (!res.ok) {
          if (!cancelled) setError(json.error || "Failed to load badges.");
          return;
        }
        if (!cancelled) setBadges(json.badges ?? []);
      } catch {
        if (!cancelled) setError("Failed to load badges.");
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  if (!badges) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Loading badges...
      </div>
    );
  }

  if (!badges.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
        No badges yet.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      {badges.map((badge) => (
        <div
          key={badge.id}
          className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2"
          title={badge.description ?? undefined}
        >
          {badge.image_url ? (
            <Image
              src={badge.image_url}
              alt={badge.title}
              width={32}
              height={32}
              className="h-8 w-8 rounded-md"
            />
          ) : (
            <div className="h-8 w-8 rounded-md bg-muted" />
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{badge.title}</div>
            {badge.description ? (
              <div className="truncate text-xs text-muted-foreground">
                {badge.description}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
