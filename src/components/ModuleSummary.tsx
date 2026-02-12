"use client";

import { useEffect, useState } from "react";
import type { ModuleEntry } from "@/lib/types";

export type SummaryPayload = {
  title?: string;
  items?: { label: string; value: string }[];
};

type SummaryConfig = {
  source: "static" | "api";
  title?: string;
  items?: { label: string; value: string }[];
  endpoint?: string;
  layout?: "list" | "excerpt" | "compact";
  maxItems?: number;
  truncate?: number;
  showTitle?: boolean;
  progressKey?: string;
  imageKey?: string;
};

export function ModuleSummary({
  module,
  override,
  surface,
  params,
  authToken,
}: {
  module: ModuleEntry;
  override?: SummaryPayload | null;
  surface?: string;
  params?: Record<string, string>;
  authToken?: string | null;
}) {
  const summary =
    (surface && module.summaryBySurface?.[surface]) || module.summary;
  const [data, setData] = useState<SummaryPayload | null>(null);
  const requiresAuth = Boolean(module.requiresAuth);
  const needsToken = requiresAuth && !authToken;
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (needsToken) {
      return;
    }
    if (!summary || summary.source !== "api" || !summary.endpoint) {
      return;
    }
    const endpoint = summary.endpoint.replace(
      /\{(\w+)\}/g,
      (_, key: string) => params?.[key] ?? "",
    );
    let cancelled = false;
    fetch(endpoint, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    })
      .then((res) => res.json())
      .then((payload) => {
        if (!cancelled) {
          setData(payload as SummaryPayload);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData({ title: "Summary unavailable", items: [] });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [summary, authToken, params, refreshKey, needsToken]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "profile-updated") {
        setRefreshKey(Date.now());
      }
    };
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "profile-updated") {
        setRefreshKey(Date.now());
      }
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  if (override) {
    return (
      <div className="rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
        {override.title ? (
          <div className="text-sm font-semibold text-foreground">
            {override.title}
          </div>
        ) : null}
        {override.items?.length ? (
          <ul className="mt-2 space-y-1">
            {override.items.map((item) => (
              <li key={item.label} className="flex items-center justify-between">
                <span>{item.label}</span>
                <span>{item.value}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  if (needsToken) {
    return (
      <div className="rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
        <div className="mt-2 text-muted-foreground">Loading summary...</div>
      </div>
    );
  }

  const resolved = data ?? summary;
  return renderSummary(resolved, summary);
}

function renderSummary(payload: SummaryPayload, config?: SummaryConfig) {
  const layout = config?.layout ?? "list";
  const maxItems = config?.maxItems;
  const truncate = config?.truncate;
  const showTitle = config?.showTitle ?? true;
  const progressKey = config?.progressKey;
  const imageKey = config?.imageKey;
  const title = payload.title ?? config?.title;
  const allItems = payload.items ?? config?.items ?? [];
  const sliceItems = (items: { label: string; value: string }[]) =>
    items.slice(0, maxItems && maxItems > 0 ? maxItems : undefined);

  const truncateValue = (value: string) =>
    truncate && value.length > truncate
      ? `${value.slice(0, Math.max(0, truncate - 3))}...`
      : value;

  const items = sliceItems(allItems);

  if (layout === "excerpt") {
    return (
      <div className="rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
        {showTitle && title ? (
          <div className="text-sm font-semibold text-foreground">{title}</div>
        ) : null}
        {items.length ? (
          <div className="mt-2 space-y-3">
            {items.map((item) => (
              <div key={item.label}>
                <div className="text-sm font-semibold text-foreground">
                  {item.label}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {truncateValue(item.value)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2 text-muted-foreground">Loading summary...</div>
        )}
      </div>
    );
  }

  if (layout === "compact") {
    const imageItem = imageKey
      ? allItems.find((item) => item.label === imageKey)
      : undefined;

    // In compact summaries, maxItems applies to *non-image* items.
    const compactItems = imageKey
      ? sliceItems(allItems.filter((item) => item.label !== imageKey))
      : items;

    return (
      <div className="rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
        {showTitle && title ? (
          <div className="text-sm font-semibold text-foreground">{title}</div>
        ) : null}
        {imageItem?.value ? (
          <div className="mt-2 flex items-center gap-3">
            <div className="h-10 w-10 overflow-hidden rounded-full border border-border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageItem.value}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
            <div className="text-xs text-muted-foreground">
              {imageItem.label}
            </div>
          </div>
        ) : null}
        {compactItems.length ? (
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {compactItems.map((item) => (
              <span key={item.label} className="rounded-full border px-2 py-0.5">
                {item.label}: {truncateValue(item.value)}
              </span>
            ))}
          </div>
        ) : (
          <div className="mt-2 text-muted-foreground">Loading summary...</div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
      {showTitle && title ? (
        <div className="text-sm font-semibold text-foreground">{title}</div>
      ) : null}
      {items.length ? (
        <ul className="mt-2 space-y-2">
          {items.map((item) => (
            <li key={item.label}>
              <div className="flex items-center justify-between">
                <span>{item.label}</span>
                <span>{truncateValue(item.value)}</span>
              </div>
              {progressKey && item.label === progressKey ? (
                <ProgressBar value={item.value} />
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-2 text-muted-foreground">Loading summary...</div>
      )}
    </div>
  );
}

function ProgressBar({ value }: { value: string }) {
  const percent = Number.parseFloat(value.replace("%", ""));
  const safe = Number.isFinite(percent)
    ? Math.min(100, Math.max(0, percent))
    : 0;

  return (
    <div className="mt-2 h-2 w-full rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-[width]"
        style={{ width: `${safe}%` }}
      />
    </div>
  );
}
