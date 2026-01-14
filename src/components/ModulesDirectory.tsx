"use client";

import { useMemo, useState } from "react";
import type { ModuleEntry } from "@/lib/types";
import { ModuleCard } from "./ModuleCard";

export function ModulesDirectory({ modules }: { modules: ModuleEntry[] }) {
  const [lane, setLane] = useState("all");
  const [status, setStatus] = useState("all");

  const lanes = useMemo(() => {
    const set = new Set(modules.map((mod) => mod.lane));
    return Array.from(set).sort();
  }, [modules]);

  const statuses = useMemo(() => {
    const set = new Set(modules.map((mod) => mod.status).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [modules]);

  const filtered = useMemo(() => {
    return modules.filter((mod) => {
      const matchesLane = lane === "all" || mod.lane === lane;
      const matchesStatus = status === "all" || mod.status === status;
      return matchesLane && matchesStatus;
    });
  }, [modules, lane, status]);

  const grouped = useMemo(() => {
    const map = new Map<string, ModuleEntry[]>();
    filtered.forEach((mod) => {
      if (!map.has(mod.lane)) {
        map.set(mod.lane, []);
      }
      map.get(mod.lane)?.push(mod);
    });
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-3">
        <select
          value={lane}
          onChange={(event) => setLane(event.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="all">All lanes</option>
          {lanes.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          {statuses.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      {grouped.map(([groupLane, items]) => (
        <section key={groupLane} className="space-y-4">
          <h2 className="text-xl font-semibold capitalize">{groupLane}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((mod) => (
              <ModuleCard key={mod.id} module={mod} />
            ))}
          </div>
        </section>
      ))}

      {!grouped.length ? (
        <p className="text-sm text-muted-foreground">
          No modules found for those filters.
        </p>
      ) : null}
    </div>
  );
}
