"use client";

import { useEffect, useState } from "react";
import type { ModuleEntry } from "@/lib/types";

type SummaryWidget = {
  mode?: "data" | "embed";
  type?: string;
  variant?: string;
  src?: string;
  height?: number;
  data?: unknown;
};

export type SummaryPayload = {
  title?: string;
  items?: { label: string; value: string }[];
  widget?: SummaryWidget;
};

function renderValueWithLink(value: string) {
  const trimmed = value.trim();
  const isInternalPath = /^\/[^\s]*$/.test(trimmed);
  const isHttpUrl = /^https?:\/\/[^\s]+$/i.test(trimmed);
  if (isInternalPath || isHttpUrl) {
    return (
      <a
        href={trimmed}
        target={isHttpUrl ? "_blank" : undefined}
        rel={isHttpUrl ? "noreferrer" : undefined}
        className="underline-offset-4 hover:underline"
      >
        {trimmed}
      </a>
    );
  }
  return <span>{value}</span>;
}

type SummaryConfig = {
  source: "static" | "api";
  title?: string;
  items?: { label: string; value: string }[];
  endpoint?: string;
  layout?: "list" | "excerpt" | "compact" | "widget";
  maxItems?: number;
  truncate?: number;
  showTitle?: boolean;
  progressKey?: string;
  imageKey?: string;
  widget?: SummaryWidget;
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
  return renderSummary(resolved, summary, params);
}

function renderSummary(
  payload: SummaryPayload,
  config?: SummaryConfig,
  params?: Record<string, string>,
) {
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

  if (layout === "widget") {
    return (
      <div className="rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
        {showTitle && title ? (
          <div className="text-sm font-semibold text-foreground">{title}</div>
        ) : null}
        <div className="mt-2">
          <SummaryWidgetView payload={payload} config={config} params={params} />
        </div>
      </div>
    );
  }

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
                  {renderValueWithLink(truncateValue(item.value))}
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
                <span>{renderValueWithLink(truncateValue(item.value))}</span>
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

function SummaryWidgetView({
  payload,
  config,
  params,
}: {
  payload: SummaryPayload;
  config?: SummaryConfig;
  params?: Record<string, string>;
}) {
  const widget: SummaryWidget = {
    ...(config?.widget ?? {}),
    ...(payload.widget ?? {}),
  };
  const mode = widget.mode ?? "data";

  if (mode === "embed") {
    const src = widget.src ? replaceParams(widget.src, params) : "";
    const height = widget.height ?? 220;
    if (!src) {
      return <FallbackSummaryItems payload={payload} config={config} />;
    }
    return (
      <iframe
        src={src}
        title={payload.title ?? config?.title ?? "Summary widget"}
        className="w-full rounded-md border border-border bg-card"
        style={{ height: Math.max(140, Math.min(480, height)) }}
        sandbox="allow-scripts"
      />
    );
  }

  if (widget.type === "chart") {
    if (widget.variant === "force-graph") {
      return <ForceGraphWidget data={widget.data} />;
    }
    return <BarChartWidget data={widget.data} />;
  }

  return <FallbackSummaryItems payload={payload} config={config} />;
}

function FallbackSummaryItems({
  payload,
  config,
}: {
  payload: SummaryPayload;
  config?: SummaryConfig;
}) {
  const items = payload.items ?? config?.items ?? [];
  if (!items.length) {
    return <div className="text-muted-foreground">Loading summary...</div>;
  }
  return (
    <ul className="space-y-2">
      {items.slice(0, 4).map((item) => (
        <li key={item.label} className="flex items-center justify-between">
          <span>{item.label}</span>
          <span>{item.value}</span>
        </li>
      ))}
    </ul>
  );
}

function BarChartWidget({ data }: { data: unknown }) {
  const series = isBarData(data) ? data.series : [];
  if (!series.length) {
    return <div className="text-muted-foreground">No chart data available.</div>;
  }
  const max = Math.max(...series.map((entry) => entry.value), 1);
  return (
    <div className="space-y-2">
      {series.slice(0, 6).map((entry) => {
        const width = Math.round((entry.value / max) * 100);
        return (
          <div key={entry.label} className="space-y-1">
            <div className="flex items-center justify-between">
              <span>{entry.label}</span>
              <span>{entry.value}</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ForceGraphWidget({ data }: { data: unknown }) {
  if (!isForceGraphData(data) || !data.nodes.length) {
    return <div className="text-muted-foreground">No graph data available.</div>;
  }
  const width = 620;
  const height = 220;

  const positions = new Map<string, { x: number; y: number; label: string; group?: string }>();
  const grouped = new Map<string, Array<{ id: string; label: string; group?: string }>>();
  data.nodes.forEach((node) => {
    const key = node.group ?? "default";
    const list = grouped.get(key) ?? [];
    list.push(node);
    grouped.set(key, list);
  });

  const preferredOrder = ["person", "skill", "role", "default"];
  const orderedGroups = Array.from(grouped.keys()).sort((a, b) => {
    const aIndex = preferredOrder.indexOf(a);
    const bIndex = preferredOrder.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  const leftPad = 30;
  const rightPad = 30;
  const topPad = 16;
  const bottomPad = 16;
  const cx = width / 2;
  const cy = height / 2;
  const rx = ((width - leftPad - rightPad) / 2) * 0.86;
  const ry = ((height - topPad - bottomPad) / 2) * 0.52;

  // Round-robin group ordering keeps clusters balanced while still grouping by type.
  const roundRobin: Array<{ id: string; label: string; group?: string }> = [];
  let added = true;
  let cursor = 0;
  while (added) {
    added = false;
    orderedGroups.forEach((groupName) => {
      const list = grouped.get(groupName) ?? [];
      if (cursor < list.length) {
        roundRobin.push(list[cursor]);
        added = true;
      }
    });
    cursor += 1;
  }

  const nodeCount = Math.max(1, roundRobin.length);
  roundRobin.forEach((node, index) => {
    const angle = -Math.PI / 2 + (index / nodeCount) * Math.PI * 2;
    const ringScale = 0.97 + (index % 3) * 0.03;
    positions.set(node.id, {
      x: cx + Math.cos(angle) * rx * ringScale,
      y: cy + Math.sin(angle) * ry * ringScale,
      label: node.label,
      group: node.group,
    });
  });

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full">
        {data.links.map((link, index) => {
          const source = positions.get(link.source);
          const target = positions.get(link.target);
          if (!source || !target) return null;
          return (
            <line
              key={`${link.source}-${link.target}-${index}`}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke="currentColor"
              opacity="0.2"
            />
          );
        })}
        {data.nodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          return (
            <g key={node.id}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r="6"
                fill={node.group === "person" ? "#bd482d" : node.group === "role" ? "#8b3521" : "#d2c141"}
              />
              <text
                x={pos.x}
                y={pos.y - 9}
                textAnchor="middle"
                fontSize="11"
                fill="currentColor"
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function replaceParams(value: string, params?: Record<string, string>) {
  return value.replace(
    /\{(\w+)\}/g,
    (_, key: string) => encodeURIComponent(params?.[key] ?? ""),
  );
}

function isBarData(
  value: unknown,
): value is { series: Array<{ label: string; value: number }> } {
  if (!value || typeof value !== "object") return false;
  const series = (value as { series?: unknown }).series;
  if (!Array.isArray(series)) return false;
  return series.every(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      typeof (entry as { label?: unknown }).label === "string" &&
      typeof (entry as { value?: unknown }).value === "number",
  );
}

function isForceGraphData(
  value: unknown,
): value is {
  nodes: Array<{ id: string; label: string; group?: string }>;
  links: Array<{ source: string; target: string }>;
} {
  if (!value || typeof value !== "object") return false;
  const nodes = (value as { nodes?: unknown }).nodes;
  const links = (value as { links?: unknown }).links;
  if (!Array.isArray(nodes) || !Array.isArray(links)) return false;
  const nodesValid = nodes.every(
    (node) =>
      node &&
      typeof node === "object" &&
      typeof (node as { id?: unknown }).id === "string" &&
      typeof (node as { label?: unknown }).label === "string",
  );
  const linksValid = links.every(
    (link) =>
      link &&
      typeof link === "object" &&
      typeof (link as { source?: unknown }).source === "string" &&
      typeof (link as { target?: unknown }).target === "string",
  );
  return nodesValid && linksValid;
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
