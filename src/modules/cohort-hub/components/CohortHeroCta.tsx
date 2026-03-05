"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthModal } from "@/components/AuthModal";
import { supabaseBrowserClient } from "@/lib/supabase/client";

export function CohortHeroCta({ cohortName }: { cohortName: string }) {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase.auth.getSession();
      if (!cancelled) {
        setIsAuthenticated(Boolean(data.session?.user));
      }
    };

    void load();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) {
        setIsAuthenticated(Boolean(session?.user));
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  if (isAuthenticated) {
    return (
      <div className="rounded-xl border border-border bg-card/80 p-4 shadow-sm">
        <p className="text-sm text-muted-foreground">Welcome back to {cohortName}.</p>
        <a
          href="/me"
          className="mt-2 inline-flex rounded-md border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted"
        >
          Go to Profile
        </a>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-card/80 p-4 shadow-sm">
        <p className="text-sm text-muted-foreground">Ready to join this cohort?</p>
        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="mt-2 inline-flex rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-background hover:opacity-90"
        >
          Join Cohort
        </button>
      </div>
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        nextPath="/modules/cohort-application"
      />
    </>
  );
}
