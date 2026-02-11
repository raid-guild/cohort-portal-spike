"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { DisplayNameGenerator } from "@/modules/profile-generators/DisplayNameGenerator";
import { AvatarGenerator } from "@/modules/profile-generators/AvatarGenerator";
import {
  createPortalRpcClient,
  emitLocalProfileRefresh,
} from "@/modules/_shared/portalRpc";

export default function ProfileGeneratorsPage() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [message, setMessage] = useState("");
  const [context, setContext] = useState("");
  const portalRpcRef = useRef<null | ((action: string, payload?: unknown) => Promise<unknown>)>(
    null,
  );

  useEffect(() => {
    const client = createPortalRpcClient("profile-generators");
    portalRpcRef.current = client.call;
    return () => {
      portalRpcRef.current = null;
      client.dispose();
    };
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "portal-auth-token") {
        setAuthToken(event.data.token);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthToken(data.session?.access_token ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthToken(session?.access_token ?? null);
    });
    return () => {
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    const loadProfile = async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;
      if (!userId) {
        if (!cancelled) {
          setDisplayName("");
          setBio("");
          setAvatarUrl("");
          setMessage("Sign in to use profile generators.");
        }
        return;
      }
      const token = data.session?.access_token;
      if (!token) {
        if (!cancelled) {
          setMessage("Sign in to use profile generators.");
        }
        return;
      }
      const res = await fetch("/api/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!cancelled && res.ok) {
        setDisplayName(json.profile?.display_name ?? "");
        setBio(json.profile?.bio ?? "");
        setAvatarUrl(json.profile?.avatar_url ?? "");
        setMessage("");
      }
    };
    loadProfile();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      loadProfile();
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  const handleApplyName = async (nextValue: string) => {
    setMessage("");
    const { data } = await supabase.auth.getSession();
    const token = authToken ?? data.session?.access_token;
    if (!token) {
      setMessage("Sign in to update your profile.");
      return;
    }

    const res = await fetch("/api/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        moduleId: "profile-generators",
        fields: { display_name: nextValue },
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setMessage(json.error || "Failed to update profile.");
      return;
    }
    setDisplayName(nextValue);
    try {
      await portalRpcRef.current?.("profile.refresh");
    } catch {
      emitLocalProfileRefresh();
    }
    setMessage("Display name updated.");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Profile Generators</h1>
        <p className="text-sm text-muted-foreground">
          Generate a display name or avatar for your profile.
        </p>
        {message ? (
          <p className="mt-2 text-xs text-muted-foreground">{message}</p>
        ) : null}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="mt-1 text-xs text-muted-foreground">
          Optional prompt to guide both generators (tone, class, vibe).
        </p>
        <textarea
          value={context}
          onChange={(event) => setContext(event.target.value)}
          placeholder="For example: Arcane hacker from the Moloch district."
          className="mt-3 min-h-[80px] w-full rounded-lg border border-border bg-background px-3 py-2 text-xs"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DisplayNameGenerator
          value={displayName}
          onApply={handleApplyName}
          authToken={authToken}
          context={context}
          bio={bio}
          compact
        />
        <AvatarGenerator
          authToken={authToken}
          displayName={displayName}
          bio={bio}
          avatarUrl={avatarUrl}
          context={context}
          compact
          onUpdated={(url) => {
            setAvatarUrl(url);
            portalRpcRef.current?.("profile.refresh")?.catch(() => emitLocalProfileRefresh());
          }}
        />
      </div>
    </div>
  );
}
