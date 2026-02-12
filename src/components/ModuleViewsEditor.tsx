"use client";

import type { ModuleEntry } from "@/lib/types";
import type { ModuleViewsConfig } from "@/lib/module-views";
import { getSurfaceViewConfig } from "@/lib/module-views";

type ModuleViewsEditorProps = {
  modules: ModuleEntry[];
  surface: string;
  config: ModuleViewsConfig | null;
  onChange: (nextConfig: ModuleViewsConfig) => void;
  onReset?: () => void;
  message?: string;
};

export function ModuleViewsEditor({
  modules,
  surface,
  config,
  onChange,
  onReset,
  message,
}: ModuleViewsEditorProps) {
  const moduleIds = modules.map((module) => module.id);
  const view = getSurfaceViewConfig(config, surface, moduleIds);
  const hiddenSet = new Set(view.hidden);
  const moduleIndex = new Map(modules.map((module) => [module.id, module]));

  const updateConfig = (nextOrder: string[], nextHidden: string[]) => {
    const nextConfig: ModuleViewsConfig = {
      version: 1,
      surfaces: {
        ...(config?.surfaces ?? {}),
        [surface]: {
          order: nextOrder,
          hidden: nextHidden,
        },
      },
    };
    onChange(nextConfig);
  };

  const move = (id: string, direction: "up" | "down") => {
    const idx = view.order.indexOf(id);
    if (idx === -1) return;
    const nextOrder = [...view.order];
    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= nextOrder.length) return;
    [nextOrder[idx], nextOrder[swapWith]] = [nextOrder[swapWith], nextOrder[idx]];
    updateConfig(nextOrder, view.hidden);
  };

  const toggleHidden = (id: string) => {
    const nextHidden = new Set(view.hidden);
    if (nextHidden.has(id)) {
      nextHidden.delete(id);
    } else {
      nextHidden.add(id);
    }
    updateConfig(view.order, Array.from(nextHidden));
  };

  if (!modules.length) {
    return (
      <div className="rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
        No modules available to customize.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
      <div className="text-sm font-semibold text-foreground">Customize modules</div>
      <div className="space-y-2">
        {view.order.map((id) => {
          const module = moduleIndex.get(id);
          if (!module) return null;
          const isHidden = hiddenSet.has(id);
          return (
            <div
              key={id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!isHidden}
                  onChange={() => toggleHidden(id)}
                />
                <span className="text-sm text-foreground">{module.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => move(id, "up")}
                  className="rounded-md border border-border px-2 py-1"
                >
                  Up
                </button>
                <button
                  type="button"
                  onClick={() => move(id, "down")}
                  className="rounded-md border border-border px-2 py-1"
                >
                  Down
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            className="rounded-md border border-border px-2 py-1"
          >
            Reset to default
          </button>
        ) : null}
        {message ? <span className="text-xs">{message}</span> : null}
      </div>
    </div>
  );
}
