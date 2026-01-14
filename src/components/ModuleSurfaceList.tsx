"use client";

import { useEffect, useMemo, useState } from "react";
import type { ModuleEntry } from "@/lib/types";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { ModuleCard } from "./ModuleCard";

export function ModuleSurfaceList({
  modules,
  surface,
  summaryParams,
}: {
  modules: ModuleEntry[];
  surface?: string;
  summaryParams?: Record<string, string>;
}) {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [roles, setRoles] = useState<string[]>([]);
  const [authToken, setAuthToken] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (!session) {
        setRoles([]);
        setAuthToken(null);
        return;
      }
      setAuthToken(session.access_token);
      const res = await fetch("/api/me/roles", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const json = await res.json();
      setRoles(json.roles ?? []);
    });
  }, [supabase]);

  const filtered = modules.filter((module) => {
    const isHostOnly = module.tags?.includes("hosts");
    if (!isHostOnly) return true;
    return roles.includes("host");
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {filtered.map((module) => (
        <div
          key={module.id}
          className={module.presentation?.layout === "wide" ? "md:col-span-2" : ""}
        >
          <ModuleCard
            module={module}
            surface={surface}
            summaryParams={summaryParams}
            authToken={authToken}
          />
        </div>
      ))}
    </div>
  );
}
