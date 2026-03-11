"use client";

import { useEffect, useMemo, useState } from "react";
import type { ModuleEntry } from "@/lib/types";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { ModuleCard } from "./ModuleCard";
import { PortalRpcBroker } from "./PortalRpcBroker";

export function ModulesDirectory({ modules }: { modules: ModuleEntry[] }) {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [lane, setLane] = useState("all");
  const [status, setStatus] = useState("all");
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
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
          fetchJson("/api/me/entitlements", {
            headers: { Authorization: `Bearer ${session.access_token}` },
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
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      void load();
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  const lanes = useMemo(() => {
    const set = new Set(modules.map((mod) => mod.lane));
    return Array.from(set).sort();
  }, [modules]);

  const statuses = useMemo(() => {
    const set = new Set(modules.map((mod) => mod.status).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [modules]);

  const visibleModules = useMemo(() => {
    return modules.filter((mod) => {
      const hasHostAccess = roles.includes("host") || roles.includes("admin");
      const requiresAuth = mod.access?.requiresAuth || mod.requiresAuth;
      if (requiresAuth && !authToken) return false;
      const isHostOnly = mod.tags?.includes("hosts");
      if (isHostOnly && !hasHostAccess) return false;
      const entitlement = mod.access?.entitlement;
      if (!entitlement) return true;
      const hostBypass = hasHostAccess && mod.tags?.includes("host-tools");
      if (hostBypass) return true;
      return entitlements.includes(entitlement);
    });
  }, [authToken, entitlements, modules, roles]);

  const filtered = useMemo(() => {
    return visibleModules.filter((mod) => {
      const matchesLane = lane === "all" || mod.lane === lane;
      const matchesStatus = status === "all" || mod.status === status;
      return matchesLane && matchesStatus;
    });
  }, [visibleModules, lane, status]);

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
      <PortalRpcBroker
        modules={visibleModules}
        authToken={authToken}
        sessionExpiresAt={sessionExpiresAt}
        roles={roles}
        entitlements={entitlements}
      />
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
              <ModuleCard key={mod.id} module={mod} authToken={authToken} />
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
