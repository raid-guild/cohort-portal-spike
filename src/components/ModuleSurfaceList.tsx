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
  const [entitlements, setEntitlements] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (!session) {
        setRoles([]);
        setAuthToken(null);
        setEntitlements([]);
        return;
      }
      setAuthToken(session.access_token);
      const [rolesRes, entitlementsRes] = await Promise.all([
        fetch("/api/me/roles", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }),
        fetch("/api/me/entitlements", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }),
      ]);
      const rolesJson = await rolesRes.json();
      const entitlementsJson = await entitlementsRes.json();
      setRoles(rolesJson.roles ?? []);
      setEntitlements(entitlementsJson.entitlements ?? []);
    });
  }, [supabase]);

  const filtered = modules.filter((module) => {
    const requiresAuth = module.access?.requiresAuth || module.requiresAuth;
    if (requiresAuth && !authToken) return false;
    const isHostOnly = module.tags?.includes("hosts");
    if (!isHostOnly) return true;
    return roles.includes("host");
  });
  const gated = filtered.filter((module) => {
    const entitlement = module.access?.entitlement;
    if (!entitlement) return true;
    return entitlements.includes(entitlement);
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {gated.map((module) => (
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
