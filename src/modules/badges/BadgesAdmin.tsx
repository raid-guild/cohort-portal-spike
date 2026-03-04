"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { ProfileMultiSelect } from "@/components/profile/ProfileMultiSelect";

type BadgeDefinition = {
  id: string;
  title: string;
};

type PersonLookup = {
  handle: string;
  displayName: string;
  avatarUrl?: string | null;
};

type CreateBadgeForm = {
  id: string;
  title: string;
  description: string;
  sortOrder: string;
};

type AwardForm = {
  badgeId: string;
  note: string;
  handleInput: string;
  handles: string[];
};

const emptyCreate: CreateBadgeForm = {
  id: "",
  title: "",
  description: "",
  sortOrder: "0",
};

const emptyAward: AwardForm = {
  badgeId: "",
  note: "",
  handleInput: "",
  handles: [],
};

function normalizeHandle(value: string) {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

export function BadgesAdmin() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [roles, setRoles] = useState<string[]>([]);
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const isHost = roles.includes("host");

  const [badges, setBadges] = useState<BadgeDefinition[]>([]);
  const [peopleLookup, setPeopleLookup] = useState<PersonLookup[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);

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

    const loadLookups = async () => {
      const [badgesRes, peopleRes] = await Promise.all([
        fetch("/api/badges"),
        fetch("/api/people?limit=500"),
      ]);
      const badgesJson = (await badgesRes.json().catch(() => ({}))) as {
        badges?: Array<{ id: string; title: string }>;
      };
      const peopleJson = (await peopleRes.json().catch(() => ({}))) as {
        people?: Array<{ handle: string; displayName: string; avatarUrl?: string | null }>;
      };
      if (!cancelled) {
        setBadges(
          (badgesJson.badges ?? [])
            .map((badge) => ({ id: badge.id, title: badge.title }))
            .sort((a, b) => a.title.localeCompare(b.title)),
        );
        setPeopleLookup(
          (peopleJson.people ?? [])
            .map((person) => ({
              handle: person.handle,
              displayName: person.displayName || person.handle,
              avatarUrl: person.avatarUrl ?? null,
            }))
            .sort((a, b) => a.handle.localeCompare(b.handle)),
        );
      }
    };

    void Promise.all([loadRoles(), loadLookups()]);
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      void Promise.all([loadRoles(), loadLookups()]);
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!createModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCreateModalOpen(false);
        setUploadFile(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createModalOpen]);

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

  const closeCreateModal = () => {
    setCreateModalOpen(false);
    setUploadFile(null);
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
      closeCreateModal();
      const refresh = await fetch("/api/badges");
      const refreshJson = (await refresh.json().catch(() => ({}))) as {
        badges?: Array<{ id: string; title: string }>;
      };
      setBadges(
        (refreshJson.badges ?? [])
          .map((badge) => ({ id: badge.id, title: badge.title }))
          .sort((a, b) => a.title.localeCompare(b.title)),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed.");
    } finally {
      setLoading(false);
    }
  };

  const addHandleToSelection = (value: string) => {
    const normalized = normalizeHandle(value);
    if (!normalized) return;
    setAwardForm((current) => {
      if (current.handles.includes(normalized)) {
        return { ...current, handleInput: "" };
      }
      return {
        ...current,
        handles: [...current.handles, normalized],
        handleInput: "",
      };
    });
  };

  const removeHandleFromSelection = (handle: string) => {
    setAwardForm((current) => ({
      ...current,
      handles: current.handles.filter((value) => value !== handle),
    }));
  };

  const handleAward = async () => {
    setMessage("");
    setLoading(true);
    try {
      const token = await ensureSession();
      if (!awardForm.badgeId.trim()) {
        throw new Error("Select a badge first.");
      }
      if (!awardForm.handles.length) {
        throw new Error("Select at least one handle.");
      }

      const res = await fetch("/api/badges/award/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          handles: awardForm.handles,
          badgeId: awardForm.badgeId,
          note: awardForm.note,
          source: "badges-admin",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to award badge.");
      }
      setMessage(`Badge awarded to ${json.awarded ?? awardForm.handles.length} user(s).`);
      setAwardForm((current) => ({ ...emptyAward, badgeId: current.badgeId }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Host tools</h2>
          <p className="text-sm text-muted-foreground">
            Create badges and issue a badge to multiple users at once.
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
          onClick={() => setCreateModalOpen(true)}
        >
          Create / edit badge
        </button>
      </div>

      {message ? <div className="text-sm text-muted-foreground">{message}</div> : null}

      <div className="space-y-3">
        <div className="text-sm font-medium">Issue badge</div>
        <label className="block text-xs text-muted-foreground" htmlFor="badge-award-id">
          Badge
        </label>
        <select
          id="badge-award-id"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          value={awardForm.badgeId}
          onChange={(event) =>
            setAwardForm((current) => ({ ...current, badgeId: event.target.value }))
          }
        >
          <option value="">Select a badge</option>
          {badges.map((badge) => (
            <option key={badge.id} value={badge.id}>
              {badge.title} ({badge.id})
            </option>
          ))}
        </select>

        <ProfileMultiSelect
          label="Add handles"
          options={peopleLookup}
          selectedHandles={awardForm.handles}
          inputValue={awardForm.handleInput}
          onInputValueChange={(value) =>
            setAwardForm((current) => ({ ...current, handleInput: value }))
          }
          onAddHandle={addHandleToSelection}
          onRemoveHandle={removeHandleFromSelection}
          placeholder="Type handle and press Enter"
          datalistId="badge-handle-options"
          disabled={loading}
        />

        <label className="block text-xs text-muted-foreground" htmlFor="badge-award-note">
          Note
        </label>
        <input
          id="badge-award-note"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          value={awardForm.note}
          onChange={(event) =>
            setAwardForm((current) => ({ ...current, note: event.target.value }))
          }
          placeholder="Awarded for shipping v0"
        />

        <button
          disabled={loading}
          onClick={handleAward}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
        >
          Issue badge
        </button>
      </div>

      <div className="text-xs text-muted-foreground">
        Note: handle-based awards require the profile to have a linked `user_id`.
      </div>

      {createModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="badge-create-dialog-title"
            className="w-full max-w-xl rounded-xl border border-border bg-card p-5 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 id="badge-create-dialog-title" className="text-base font-semibold">
                Create / update badge
              </h3>
              <button
                type="button"
                className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted"
                onClick={closeCreateModal}
                aria-label="Close dialog"
              >
                Close
              </button>
            </div>

            <div className="space-y-3">
              <label htmlFor="badge-create-id" className="block text-xs text-muted-foreground">
                Badge ID
              </label>
              <input
                id="badge-create-id"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={createForm.id}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, id: event.target.value }))
                }
                placeholder="shipper"
              />

              <label htmlFor="badge-create-title" className="block text-xs text-muted-foreground">
                Title
              </label>
              <input
                id="badge-create-title"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={createForm.title}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, title: event.target.value }))
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
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Consistently delivers work"
              />

              <label htmlFor="badge-create-sort" className="block text-xs text-muted-foreground">
                Sort order
              </label>
              <input
                id="badge-create-sort"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={createForm.sortOrder}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, sortOrder: event.target.value }))
                }
                inputMode="numeric"
              />

              <label htmlFor="badge-create-image" className="block text-xs text-muted-foreground">
                Image
              </label>
              <input
                id="badge-create-image"
                type="file"
                accept="image/*"
                onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                className="block w-full text-sm"
              />
            </div>

            <div className="mt-4 flex gap-2">
              <button
                disabled={loading}
                onClick={handleCreate}
                className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
              >
                Save badge
              </button>
              <button
                type="button"
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
                onClick={closeCreateModal}
              >
                Cancel
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
