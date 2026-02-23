"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";

export function EntitlementOnly({
  entitlement,
  children,
  fallback,
}: {
  entitlement: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [allowed, setAllowed] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) {
        if (cancelled) return;
        setAllowed(false);
        setChecked(true);
        return;
      }

      try {
        const res = await fetch("/api/me/entitlements", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        const json = (await res.json().catch(() => null)) as
          | { entitlements?: string[] }
          | null;
        if (cancelled) return;
        setAllowed((json?.entitlements ?? []).includes(entitlement));
      } catch {
        if (cancelled) return;
        setAllowed(false);
      } finally {
        if (!cancelled) {
          setChecked(true);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [entitlement, supabase]);

  if (!checked) {
    return null;
  }

  if (!allowed) {
    return (
      fallback ?? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Access requires the <span className="font-medium">{entitlement}</span> entitlement.
        </div>
      )
    );
  }

  return <>{children}</>;
}
