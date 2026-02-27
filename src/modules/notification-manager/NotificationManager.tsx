"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type Cadence = "daily" | "weekly";

type PreferenceResponse = {
  preferences?: {
    email_enabled?: boolean;
    cadence?: Cadence;
    blog_enabled?: boolean;
    forum_enabled?: boolean;
    grimoire_enabled?: boolean;
  };
  error?: string;
};

type Preferences = {
  emailEnabled: boolean;
  cadence: Cadence;
  blogEnabled: boolean;
  forumEnabled: boolean;
  grimoireEnabled: boolean;
};

const DEFAULT_PREFERENCES: Preferences = {
  emailEnabled: false,
  cadence: "daily",
  blogEnabled: false,
  forumEnabled: false,
  grimoireEnabled: false,
};

export function NotificationManager() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [authLoading, setAuthLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token ?? null);
      setAuthLoading(false);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;

    const loadPreferences = async () => {
      if (!token) {
        if (!cancelled) {
          setLoading(false);
          setPreferences(DEFAULT_PREFERENCES);
        }
        return;
      }

      setLoading(true);
      setError(null);
      setMessage(null);

      try {
        const res = await fetch("/api/me/notification-preferences", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = (await res.json().catch(() => ({}))) as PreferenceResponse;

        if (!res.ok) {
          throw new Error(payload.error ?? `Request failed (${res.status})`);
        }

        if (!cancelled) {
          const pref = payload.preferences;
          setPreferences({
            emailEnabled: pref?.email_enabled ?? false,
            cadence: pref?.cadence === "weekly" ? "weekly" : "daily",
            blogEnabled: pref?.blog_enabled ?? false,
            forumEnabled: pref?.forum_enabled ?? false,
            grimoireEnabled: pref?.grimoire_enabled ?? false,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load preferences.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadPreferences();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function savePreferences() {
    if (!token) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/me/notification-preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(preferences),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? `Save failed (${res.status})`);
      }
      setMessage("Preferences saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save preferences.");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
        Loading notification preferences...
      </div>
    );
  }

  if (!token) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
        Sign in to manage your notification preferences.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Email notifications</h2>
        <p className="text-sm text-muted-foreground">
          Notifications are off by default until you opt in.
        </p>
      </div>

      <label className="flex items-center justify-between rounded-lg border border-border bg-background p-3 text-sm">
        <span className="font-medium text-foreground">Enable email notifications</span>
        <input
          type="checkbox"
          checked={preferences.emailEnabled}
          onChange={(event) =>
            setPreferences((prev) => ({ ...prev, emailEnabled: event.target.checked }))
          }
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">Cadence</legend>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="radio"
            name="cadence"
            value="daily"
            checked={preferences.cadence === "daily"}
            onChange={() => setPreferences((prev) => ({ ...prev, cadence: "daily" }))}
          />
          Daily
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="radio"
            name="cadence"
            value="weekly"
            checked={preferences.cadence === "weekly"}
            onChange={() => setPreferences((prev) => ({ ...prev, cadence: "weekly" }))}
          />
          Weekly
        </label>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">Topics</legend>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={preferences.blogEnabled}
            onChange={(event) =>
              setPreferences((prev) => ({ ...prev, blogEnabled: event.target.checked }))
            }
          />
          Blog
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={preferences.forumEnabled}
            onChange={(event) =>
              setPreferences((prev) => ({ ...prev, forumEnabled: event.target.checked }))
            }
          />
          Forum
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={preferences.grimoireEnabled}
            onChange={(event) =>
              setPreferences((prev) => ({ ...prev, grimoireEnabled: event.target.checked }))
            }
          />
          Grimoire
        </label>
      </fieldset>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

      <div>
        <button
          type="button"
          onClick={() => void savePreferences()}
          disabled={saving}
          className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save preferences"}
        </button>
      </div>
    </div>
  );
}
