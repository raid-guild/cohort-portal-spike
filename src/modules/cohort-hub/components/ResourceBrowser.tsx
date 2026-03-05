"use client";

import { useMemo } from "react";
import type { ResourceCard } from "@/modules/cohort-hub/landing-types";

function getYouTubeVideoId(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace("www.", "").toLowerCase();

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
      return id || null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      const value = parsed.searchParams.get("v");
      if (value) return value;
      const parts = parsed.pathname.split("/").filter(Boolean);
      if ((parts[0] === "shorts" || parts[0] === "embed") && parts[1]) return parts[1];
    }
    return null;
  } catch {
    return null;
  }
}

export function ResourceBrowser({ resources }: { resources: ResourceCard[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, ResourceCard[]>();
    for (const item of resources) {
      const key = item.category || "General";
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [resources]);

  if (!resources.length) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        Resources coming soon.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {grouped.map(([category, items], index) => (
        <details
          key={category}
          open={index === 0}
          className="group rounded-xl border border-border bg-card p-3"
        >
          <summary className="cursor-pointer list-none text-sm font-semibold">{category}</summary>
          <div className="mt-3 space-y-3">
            {items.map((resource) => {
              const ytId = resource.link ? getYouTubeVideoId(resource.link) : null;
              return (
                <article key={resource.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{resource.title}</p>
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                      {resource.type}
                    </span>
                  </div>
                  {resource.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">{resource.description}</p>
                  ) : null}
                  {resource.link ? (
                    <a
                      href={resource.link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block break-all text-sm underline-offset-4 hover:underline"
                    >
                      {resource.link}
                    </a>
                  ) : null}
                  {ytId ? (
                    <div className="mt-3 overflow-hidden rounded-md border border-border">
                      <iframe
                        title={`${resource.title} preview`}
                        src={`https://www.youtube.com/embed/${ytId}`}
                        className="aspect-video w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                      />
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </details>
      ))}
    </div>
  );
}
