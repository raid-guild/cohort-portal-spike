"use client";

import { useEffect, useMemo, useState } from "react";
import type { ModuleEntry } from "@/lib/types";
import type { ModuleViewsConfig } from "@/lib/module-views";
import { getSurfaceViewConfig } from "@/lib/module-views";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { ModuleCard } from "./ModuleCard";
import { PortalRpcBroker } from "./PortalRpcBroker";

type CardLayout = "compact" | "default" | "wide";

function getCardLayout(module: ModuleEntry): CardLayout {
  const layout = module.presentation?.layout;
  if (layout === "compact" || layout === "wide") return layout;
  return "default";
}

function getCardSpanClass(layout: CardLayout) {
  if (layout === "compact") {
    return "sm:col-span-1 lg:col-span-3 xl:col-span-2";
  }
  if (layout === "wide") {
    return "lg:col-span-12";
  }
  return "sm:col-span-1 lg:col-span-6 xl:col-span-4";
}

export function ModuleSurfaceList({
  modules,
  surface,
  summaryParams,
  viewConfig,
}: {
  modules: ModuleEntry[];
  surface?: string;
  summaryParams?: Record<string, string>;
  viewConfig?: ModuleViewsConfig | null;
}) {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [roles, setRoles] = useState<string[]>([]);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [entitlements, setEntitlements] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const fetchJson = async (input: RequestInfo | URL, init?: RequestInit) => {
      const res = await fetch(input, init);
      if (!res.ok) return null;

      try {
        return await res.json();
      } catch {
        return null;
      }
    };

    const load = async () => {
      try {
        const { data } = await supabase.auth.getSession();

        const session = data.session;
        if (!session) {
          if (cancelled) return;
          setRoles([]);
          setAuthToken(null);
          setSessionExpiresAt(null);
          setEntitlements([]);
          return;
        }

        if (cancelled) return;
        setAuthToken(session.access_token);
        setSessionExpiresAt(session.expires_at ?? null);

        const [rolesJson, entitlementsJson] = await Promise.all([
          fetchJson("/api/me/roles", {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }),
          fetchJson("/api/me/entitlements", {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }),
        ]);

        if (cancelled) return;
        setRoles(rolesJson?.roles ?? []);
        setEntitlements(entitlementsJson?.entitlements ?? []);
      } catch {
        if (cancelled) return;
        setRoles([]);
        setAuthToken(null);
        setSessionExpiresAt(null);
        setEntitlements([]);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
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

  const moduleIds = gated.map((module) => module.id);
  const surfaceView =
    surface && viewConfig ? getSurfaceViewConfig(viewConfig, surface, moduleIds) : null;
  const hiddenSet = surfaceView ? new Set(surfaceView.hidden) : null;
  const baseIndex = new Map(moduleIds.map((id, index) => [id, index]));

  let ordered = gated.filter((module) => !hiddenSet?.has(module.id));
  if (surfaceView?.order?.length) {
    const orderIndex = new Map(surfaceView.order.map((id, index) => [id, index]));
    ordered = [...ordered].sort((a, b) => {
      const aOrder = orderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bOrder = orderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (baseIndex.get(a.id) ?? 0) - (baseIndex.get(b.id) ?? 0);
    });
  }

  const compact = ordered.filter((module) => getCardLayout(module) === "compact");
  const nonCompact = ordered.filter((module) => getCardLayout(module) !== "compact");
  const arranged = [...compact, ...nonCompact];

  return (
    <>
      <PortalRpcBroker
        modules={gated}
        authToken={authToken}
        sessionExpiresAt={sessionExpiresAt}
        roles={roles}
        entitlements={entitlements}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
        {arranged.map((module) => (
          <div key={module.id} className={getCardSpanClass(getCardLayout(module))}>
            <ModuleCard
              module={module}
              surface={surface}
              summaryParams={summaryParams}
              authToken={authToken}
            />
          </div>
        ))}
      </div>
    </>
  );
}
