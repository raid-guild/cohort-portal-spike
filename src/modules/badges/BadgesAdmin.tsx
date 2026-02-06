"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type CreateBadgeForm = {
  id: string;
  title: string;
  description: string;
  sortOrder: string;
};

type AwardForm = {
  handle: string;
  badgeId: string;
  note: string;
};

const emptyCreate: CreateBadgeForm = {
  id: "",
  title: "",
  description: "",
  sortOrder: "0",
};

const emptyAward: AwardForm = {
  handle: "",
  badgeId: "",
  note: "",
};

export function BadgesAdmin() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [roles, setRoles] = useState<string[]>([]);
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const isHost = roles.includes("host");

  const [createForm, setCreateForm] = useState<CreateBadgeForm>(emptyCreate);
  const [awardForm, setAwardForm] = useState<AwardForm>(emptyAward);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");

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

  if (rolesLoaded && !isHost) {
    return null;
  }

  const ensureSession = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      throw new Error("Sign in as a host to manage badges.");
    }
    return token;
  };

  const uploadImage = async (badgeId: string, token: string) => {
    if (!uploadFile) return null;

    const form = new FormData();
    form.set("badgeId", badgeId);
    form.set("file", uploadFile);

    const res = await fetch("/api/badges/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || "Failed to upload image.");
    }

    return String(json.url);
  };

  const handleCreate = async () => {
    setMessage("");
    setLoading(true);
    try {
      const token = await ensureSession();

      const rawId = createForm.id.trim() || createForm.title.trim();
      const finalId = rawId
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\-]/g, "");

      const title = createForm.title.trim();
      if (!finalId || !title) {
        throw new Error("Badge ID (or title) and title are required.");
      }

      // Create/update the badge first to avoid orphaned uploads.
      const createRes = await fetch("/api/badges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: finalId,
          title,
          description: createForm.description,
          sortOrder: Number(createForm.sortOrder || "0"),
          imageUrl: null,
        }),
      });
      const createJson = await createRes.json();
      if (!createRes.ok) {
        throw new Error(createJson.error || "Failed to save badge.");
      }

      const imageUrl = await uploadImage(finalId, token);
      if (imageUrl) {
        const updateRes = await fetch("/api/badges", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            id: finalId,
            title,
            description: createForm.description,
            sortOrder: Number(createForm.sortOrder || "0"),
            imageUrl,
          }),
        });
        const updateJson = await updateRes.json();
        if (!updateRes.ok) {
          throw new Error(updateJson.error || "Failed to save badge image.");
        }
      }

      setMessage("Badge saved.");
      setCreateForm(emptyCreate);
      setUploadFile(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleAward = async () => {
    setMessage("");
    setLoading(true);
    try {
      const token = await ensureSession();
      const res = await fetch("/api/badges/award", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          handle: awardForm.handle,
          badgeId: awardForm.badgeId,
          note: awardForm.note,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to award badge.");
      }
      setMessage("Badge awarded.");
      setAwardForm(emptyAward);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-6">
      <div>
        <h2 className="text-lg font-semibold">Host tools</h2>
        <p className="text-sm text-muted-foreground">
          Create badges, upload images, and award badges to profiles.
        </p>
      </div>

      {message ? (
        <div className="text-sm text-muted-foreground">{message}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="text-sm font-medium">Create / update badge</div>

          <label
            htmlFor="badge-create-id"
            className="block text-xs text-muted-foreground"
          >
            Badge ID
          </label>
          <input
            id="badge-create-id"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={createForm.id}
            onChange={(e) =>
              setCreateForm((s) => ({ ...s, id: e.target.value }))
            }
            placeholder="shipper"
          />

          <label
            htmlFor="badge-create-title"
            className="block text-xs text-muted-foreground"
          >
            Title
          </label>
          <input
            id="badge-create-title"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={createForm.title}
            onChange={(e) =>
              setCreateForm((s) => ({ ...s, title: e.target.value }))
            }
            placeholder="Shipper"
          />

          <label
            htmlFor="badge-create-description"
            className="block text-xs text-muted-foreground"
          >
            Description
          </label>
          <input
            id="badge-create-description"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={createForm.description}
            onChange={(e) =>
              setCreateForm((s) => ({ ...s, description: e.target.value }))
            }
            placeholder="Consistently delivers work"
          />

          <label
            htmlFor="badge-create-sort"
            className="block text-xs text-muted-foreground"
          >
            Sort order
          </label>
          <input
            id="badge-create-sort"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={createForm.sortOrder}
            onChange={(e) =>
              setCreateForm((s) => ({ ...s, sortOrder: e.target.value }))
            }
            inputMode="numeric"
          />

          <label
            htmlFor="badge-create-image"
            className="block text-xs text-muted-foreground"
          >
            Image
          </label>
          <input
            id="badge-create-image"
            type="file"
            accept="image/*"
            onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm"
          />

          <button
            disabled={loading}
            onClick={handleCreate}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
          >
            Save badge
          </button>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium">Award badge</div>

          <label
            htmlFor="badge-award-handle"
            className="block text-xs text-muted-foreground"
          >
            Profile handle
          </label>
          <input
            id="badge-award-handle"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={awardForm.handle}
            onChange={(e) =>
              setAwardForm((s) => ({ ...s, handle: e.target.value }))
            }
            placeholder="deke"
          />

          <label
            htmlFor="badge-award-id"
            className="block text-xs text-muted-foreground"
          >
            Badge ID
          </label>
          <input
            id="badge-award-id"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={awardForm.badgeId}
            onChange={(e) =>
              setAwardForm((s) => ({ ...s, badgeId: e.target.value }))
            }
            placeholder="shipper"
          />

          <label
            htmlFor="badge-award-note"
            className="block text-xs text-muted-foreground"
          >
            Note
          </label>
          <input
            id="badge-award-note"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={awardForm.note}
            onChange={(e) => setAwardForm((s) => ({ ...s, note: e.target.value }))}
            placeholder="Awarded for shipping v0"
          />

          <button
            disabled={loading}
            onClick={handleAward}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
          >
            Award
          </button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Note: awarding by handle requires that profile to have a linked user_id.
      </div>
    </div>
  );
}
