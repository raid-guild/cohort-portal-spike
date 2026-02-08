"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { PaidStar } from "./PaidStar";

export function AuthLink() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [signedIn, setSignedIn] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initials, setInitials] = useState<string>("RG");
  const [isPaid, setIsPaid] = useState(false);

  const loadProfile = useCallback(
    async (userId: string) => {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, display_name, handle")
        .eq("user_id", userId)
        .maybeSingle();
      setAvatarUrl(data?.avatar_url ?? null);
      const nameSource = data?.display_name || data?.handle || "";
      setInitials(getInitials(nameSource));
    },
    [supabase],
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      setSignedIn(Boolean(session));
      if (session?.user?.id) {
        loadProfile(session.user.id);
        fetch("/api/me/entitlements", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
          .then((res) => res.json())
          .then((json) => {
            setIsPaid((json.entitlements ?? []).includes("cohort-access"));
          })
          .catch(() => setIsPaid(false));
      } else {
        setAvatarUrl(null);
        setIsPaid(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSignedIn(Boolean(session));
        if (session?.user?.id) {
          loadProfile(session.user.id);
          fetch("/api/me/entitlements", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
            .then((res) => res.json())
            .then((json) => {
              setIsPaid((json.entitlements ?? []).includes("cohort-access"));
            })
            .catch(() => setIsPaid(false));
        } else {
          setAvatarUrl(null);
          setIsPaid(false);
        }
      },
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [loadProfile, supabase]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "profile-updated") {
        supabase.auth.getSession().then(({ data }) => {
          if (data.session?.user?.id) {
            loadProfile(data.session.user.id);
          }
        });
      }
    };
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "profile-updated") {
        supabase.auth.getSession().then(({ data }) => {
          if (data.session?.user?.id) {
            loadProfile(data.session.user.id);
          }
        });
      }
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("message", handleMessage);
    };
  }, [loadProfile, supabase]);

  return (
    <Link
      href="/me"
      className="rounded-full border border-border px-3 py-2 text-xs hover:bg-muted"
    >
      <span className="inline-flex items-center gap-2">
        {signedIn ? (
          <span className="relative inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-[10px] font-semibold text-muted-foreground">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
            {isPaid ? <PaidStar className="absolute -right-1 -top-1 h-3 w-3" /> : null}
          </span>
        ) : null}
        <span>{signedIn ? "Profile" : "Sign in"}</span>
      </span>
    </Link>
  );
}

function getInitials(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "RG";
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase()).join("");
}
