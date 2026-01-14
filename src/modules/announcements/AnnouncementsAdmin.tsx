"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type FormState = {
  title: string;
  body: string;
  status: "draft" | "published";
  audience: "public" | "authenticated" | "host";
  roleTargets: string;
  startsAt: string;
  endsAt: string;
};

const emptyForm: FormState = {
  title: "",
  body: "",
  status: "published",
  audience: "public",
  roleTargets: "",
  startsAt: "",
  endsAt: "",
};

export function AnnouncementsAdmin() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const isHost = roles.includes("host");

  useEffect(() => {
    let cancelled = false;
    const loadRoles = async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        if (!cancelled) {
          setRoles([]);
          setRolesLoaded(true);
        }
        return;
      }
      const res = await fetch("/api/me/roles", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!cancelled) {
        setRoles(json.roles ?? []);
        setRolesLoaded(true);
      }
    };
    loadRoles();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      loadRoles();
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  if (rolesLoaded && !roles.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        You need a role to publish announcements.
      </div>
    );
  }

  const handleSubmit = async () => {
    setMessage("");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setMessage("Sign in to publish announcements.");
      return;
    }

    if (!roles.length) {
      setMessage("No roles assigned to your account.");
      return;
    }

    const roleTargets = isHost
      ? form.roleTargets
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : roles;
    const audience = isHost ? form.audience : "authenticated";

    setLoading(true);
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({
          title: form.title,
          body: form.body,
          status: form.status,
          audience,
          roleTargets: roleTargets.length ? roleTargets : null,
          startsAt: form.startsAt || null,
          endsAt: form.endsAt || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to publish announcement.");
      }
      setMessage("Announcement saved.");
      setForm(emptyForm);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-6">
      <div>
        <h2 className="text-lg font-semibold">Create announcement</h2>
        <p className="text-sm text-muted-foreground">
          Publish time-boxed updates for the cohort.
        </p>
      </div>
      <label className="space-y-2 text-sm">
        <span className="font-semibold">Title</span>
        <input
          value={form.title}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, title: event.target.value }))
          }
          className="w-full rounded-lg border border-border bg-background px-3 py-2"
        />
      </label>
      <label className="space-y-2 text-sm">
        <span className="font-semibold">Body</span>
        <textarea
          value={form.body}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, body: event.target.value }))
          }
          className="min-h-[140px] w-full rounded-lg border border-border bg-background px-3 py-2"
        />
      </label>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-2 text-sm">
          <span className="font-semibold">Status</span>
          <select
            value={form.status}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                status: event.target.value as FormState["status"],
              }))
            }
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          >
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-semibold">Audience</span>
          <select
            value={isHost ? form.audience : "authenticated"}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                audience: event.target.value as FormState["audience"],
              }))
            }
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
            disabled={!isHost}
          >
            <option value="public">Public</option>
            <option value="authenticated">Authenticated</option>
            <option value="host">Hosts</option>
          </select>
          {!isHost ? (
            <div className="text-xs text-muted-foreground">
              Only hosts can publish to public or host audiences.
            </div>
          ) : null}
        </label>
      <label className="space-y-2 text-sm">
        <span className="font-semibold">Role targets</span>
        <input
          value={form.roleTargets}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              roleTargets: event.target.value,
            }))
          }
          placeholder="host, builder"
          className="w-full rounded-lg border border-border bg-background px-3 py-2"
          disabled={!isHost}
        />
        {!isHost ? (
          <div className="text-xs text-muted-foreground">
            Announcements will target your role(s): {roles.join(", ") || "none"}
          </div>
        ) : null}
      </label>
    </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="font-semibold">Starts at (UTC)</span>
          <input
            value={form.startsAt}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, startsAt: event.target.value }))
            }
            placeholder="2026-01-12T19:00:00Z"
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-semibold">Ends at (UTC)</span>
          <input
            value={form.endsAt}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, endsAt: event.target.value }))
            }
            placeholder="2026-01-12T21:00:00Z"
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          className="rounded-lg border border-border bg-primary px-4 py-2 text-sm text-background hover:opacity-90"
          disabled={loading}
        >
          {loading ? "Saving..." : "Save announcement"}
        </button>
        {message ? (
          <span className="text-sm text-muted-foreground">{message}</span>
        ) : null}
      </div>
    </div>
  );
}
