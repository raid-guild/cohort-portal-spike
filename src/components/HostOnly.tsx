"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";

export function HostOnly({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [isHost, setIsHost] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (!session) {
        setIsHost(false);
        setChecked(true);
        return;
      }
      const res = await fetch("/api/me/roles", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const json = await res.json();
      setIsHost((json.roles ?? []).includes("host"));
      setChecked(true);
    });
  }, [supabase]);

  if (!checked) {
    return null;
  }

  if (!isHost) {
    return (
      fallback ?? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Host access required.
        </div>
      )
    );
  }

  return <>{children}</>;
}
