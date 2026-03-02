"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";

export function CohortLandingHostLink({ landingPath }: { landingPath: string }) {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        if (!cancelled) setIsHost(false);
        return;
      }

      const res = await fetch("/api/me/roles", {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);
      if (!res?.ok) {
        if (!cancelled) setIsHost(false);
        return;
      }

      const json = (await res.json().catch(() => ({}))) as { roles?: string[] };
      if (!cancelled) setIsHost((json.roles ?? []).includes("host"));
    };
    void load();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  if (!isHost) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">
        Host view: manage this landing page content in{" "}
        <a href="/modules/cohort-hub" className="underline-offset-4 hover:underline">
          Cohort Hub
        </a>
        . Current public URL:{" "}
        <a href={landingPath} className="underline-offset-4 hover:underline">
          {landingPath}
        </a>
      </p>
    </section>
  );
}
