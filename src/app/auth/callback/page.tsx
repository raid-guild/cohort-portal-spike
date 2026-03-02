"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { isOnboardingComplete } from "@/lib/onboarding";

function sanitizeNext(raw: string | null) {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  if (raw.startsWith("/auth/callback")) return "/";
  return raw;
}

export default function AuthCallbackPage() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Signing you in...");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const code = searchParams.get("code");
        const next = sanitizeNext(searchParams.get("next"));

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error && !cancelled) {
            setMessage(error.message);
            return;
          }
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user?.id) {
          if (!cancelled) {
            router.replace("/me");
          }
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("handle, display_name, bio, skills, roles")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        const complete = isOnboardingComplete({
          handle: data?.handle ?? "",
          displayName: data?.display_name ?? "",
          bio: data?.bio ?? "",
          skills: data?.skills ?? [],
          roles: data?.roles ?? [],
        });

        if (cancelled) return;
        router.replace(complete ? next : "/me?onboarding=1");
      } catch (error) {
        if (cancelled) return;
        console.error("Auth callback failed", error);
        setMessage("Unable to complete sign-in. Please try again.");
        router.replace("/me");
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams, supabase]);

  return (
    <main className="container-custom py-12">
      <p className="text-sm text-muted-foreground">{message}</p>
    </main>
  );
}
