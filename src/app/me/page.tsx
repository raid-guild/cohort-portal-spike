"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { ModuleSurfaceList } from "@/components/ModuleSurfaceList";
import { ModuleViewsEditor } from "@/components/ModuleViewsEditor";
import type { ModuleEntry } from "@/lib/types";
import type { ModuleViewsConfig } from "@/lib/module-views";
import { PaidStar } from "@/components/PaidStar";

type ProfileForm = {
  handle: string;
  displayName: string;
  bio: string;
  location: string;
  skills: string[];
  roles: string[];
  walletAddress: string;
  email: string;
  avatarUrl: string;
};

const emptyProfile: ProfileForm = {
  handle: "",
  displayName: "",
  bio: "",
  location: "",
  skills: [],
  roles: [],
  walletAddress: "",
  email: "",
  avatarUrl: "",
};

export default function MePage() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState<ProfileForm>(emptyProfile);
  const [profileExists, setProfileExists] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [availableSkills, setAvailableSkills] = useState<string[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [linking, setLinking] = useState(false);
  const [meTools, setMeTools] = useState<ModuleEntry[]>([]);
  const [portalRoles, setPortalRoles] = useState<string[]>([]);
  const [isPaid, setIsPaid] = useState(false);
  const [paidSource, setPaidSource] = useState<string | null>(null);
  const [moduleViewConfig, setModuleViewConfig] = useState<ModuleViewsConfig | null>(
    null,
  );
  const [moduleViewMessage, setModuleViewMessage] = useState("");
  const [showModuleCustomize, setShowModuleCustomize] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
      },
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    fetch("/api/modules")
      .then((res) => res.json())
      .then((registry) => {
        const tools = (registry.modules ?? []).filter((module: ModuleEntry) =>
          module.tags?.includes("me-tools"),
        );
        setMeTools(tools);
      })
      .catch(() => setMeTools([]));
  }, []);

  useEffect(() => {
    if (!user) {
      setModuleViewConfig(null);
      setModuleViewMessage("");
      return;
    }
    let cancelled = false;
    supabase
      .from("module_data")
      .select("payload")
      .eq("module_id", "module-views")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.payload) {
          setModuleViewConfig(null);
          return;
        }
        setModuleViewConfig(data.payload as ModuleViewsConfig);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

  const saveModuleViews = useCallback(
    async (nextConfig: ModuleViewsConfig) => {
      const prevConfig = moduleViewConfig;
      setModuleViewConfig(nextConfig);
      setModuleViewMessage("Saving...");
      if (!user) {
        setModuleViewConfig(prevConfig);
        setModuleViewMessage("Sign in to save module views.");
        return;
      }
      const { error } = await supabase.from("module_data").upsert(
        {
          module_id: "module-views",
          user_id: user.id,
          visibility: "private",
          payload: nextConfig,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "module_id,user_id" },
      );
      if (error) {
        setModuleViewConfig(prevConfig);
        setModuleViewMessage(error.message);
        return;
      }
      setModuleViewMessage("Saved.");
    },
    [moduleViewConfig, supabase, user],
  );

  const resetModuleViews = useCallback(async () => {
    const prevConfig = moduleViewConfig;
    setModuleViewConfig(null);
    setModuleViewMessage("Resetting...");
    if (!user) {
      setModuleViewConfig(prevConfig);
      setModuleViewMessage("Sign in to reset module views.");
      return;
    }
    const { error } = await supabase
      .from("module_data")
      .delete()
      .eq("module_id", "module-views")
      .eq("user_id", user.id);
    if (error) {
      setModuleViewConfig(prevConfig);
      setModuleViewMessage(error.message);
      return;
    }
    setModuleViewMessage("Reset to defaults.");
  }, [moduleViewConfig, supabase, user]);

  const loadProfile = useCallback(async () => {
    if (!user) {
      setProfile(emptyProfile);
      setProfileExists(false);
      setPortalRoles([]);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select(
        "handle, display_name, bio, location, skills, roles, wallet_address, email, avatar_url",
      )
      .eq("user_id", user.id)
      .maybeSingle();
    const walletFromIdentity = getWalletFromUser(user);
    if (!data) {
      setProfile({
        ...emptyProfile,
        walletAddress: walletFromIdentity ?? "",
        email: user.email ?? "",
      });
      setProfileExists(false);
      return;
    }
    setProfile({
      handle: data.handle ?? "",
      displayName: data.display_name ?? "",
      bio: data.bio ?? "",
      location: data.location ?? "",
      skills: data.skills ?? [],
      roles: data.roles ?? [],
      walletAddress: data.wallet_address ?? walletFromIdentity ?? "",
      email: data.email ?? user.email ?? "",
      avatarUrl: data.avatar_url ?? "",
    });
    setProfileExists(true);
  }, [supabase, user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!user) return;
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "profile-updated") {
        loadProfile();
      }
    };
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "profile-updated") {
        loadProfile();
      }
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("message", handleMessage);
    };
  }, [loadProfile, user]);

  useEffect(() => {
    if (!session) {
      setPortalRoles([]);
      setIsPaid(false);
      setPaidSource(null);
      return;
    }
    fetch("/api/me/roles", {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })
      .then((res) => res.json())
      .then((json) => setPortalRoles(json.roles ?? []))
      .catch(() => setPortalRoles([]));

    fetch("/api/me/entitlements", {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })
      .then((res) => res.json())
      .then((json) => {
        const entitlements = json.entitlements ?? [];
        setIsPaid(entitlements.includes("cohort-access"));
        const record =
          (json.records ?? []).find(
            (row: { entitlement?: string }) => row.entitlement === "cohort-access",
          ) ?? null;
        const metadata =
          record?.metadata && typeof record.metadata === "object"
            ? (record.metadata as Record<string, unknown>)
            : null;
        setPaidSource(typeof metadata?.source === "string" ? metadata.source : null);
      })
      .catch(() => {
        setIsPaid(false);
        setPaidSource(null);
      });
  }, [session]);

  useEffect(() => {
    supabase
      .from("skill_catalog")
      .select("skill, category")
      .order("skill")
      .then(({ data }) => {
        if (!data) return;
        setAvailableSkills(data.map((row) => row.skill));
      });

    supabase
      .from("role_catalog")
      .select("role, category")
      .order("role")
      .then(({ data }) => {
        if (!data) return;
        setAvailableRoles(data.map((row) => row.role));
      });
  }, [supabase]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null);
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [avatarFile]);

  const handleEmailSignIn = async () => {
    setLoading(true);
    setMessage("");
    const redirectTo = `${window.location.origin}/me`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    setLoading(false);
    setMessage(
      error ? error.message : "Check your email for the magic link.",
    );
  };

  const handleWeb3SignIn = async (chain: "ethereum" | "solana") => {
    setLoading(true);
    setMessage("");
    // @ts-ignore – supabase types are out of date
    const { error } = await supabase.auth.signInWithWeb3({
      chain,
      statement: "I accept the RaidGuild Cohort Portal terms of service.",
    });
    setLoading(false);
    if (error) {
      setMessage(error.message);
    }
  };

  const handleProfileSave = async () => {
    if (!user) {
      setMessage("Please sign in first.");
      return;
    }

    const trimmedHandle = profile.handle.trim();
    if (!trimmedHandle) {
      setMessage("Handle is required.");
      return;
    }
    if (!/^[a-z0-9_-]+$/i.test(trimmedHandle)) {
      setMessage("Handle can only use letters, numbers, hyphens, and underscores.");
      return;
    }

    setLoading(true);
    setMessage("");
    const walletFromIdentity = getWalletFromUser(user);
    const payload = {
      user_id: user.id,
      handle: trimmedHandle,
      display_name: profile.displayName.trim(),
      bio: profile.bio.trim() || null,
      location: profile.location.trim() || null,
      skills: profile.skills,
      roles: profile.roles,
      wallet_address: profile.walletAddress.trim() || walletFromIdentity || null,
      email: profile.email.trim() || user.email || null,
      avatar_url: profile.avatarUrl.trim() || null,
    };

    const { error } = profileExists
      ? await supabase
          .from("profiles")
          .update(payload)
          .eq("user_id", user.id)
      : await supabase.from("profiles").insert(payload);

    setLoading(false);
    setMessage(error ? error.message : "Profile saved.");
    if (!error) {
      setProfileExists(true);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleLinkEmail = async (emailValue: string) => {
    if (!emailValue.trim()) {
      setMessage("Enter an email address to link.");
      return;
    }
    setLinking(true);
    setMessage("");
    const { error } = await supabase.auth.updateUser({
      email: emailValue.trim(),
    });
    setLinking(false);
    setMessage(
      error ? error.message : "Check your email to confirm linking.",
    );
  };

  const handleAvatarUpload = async () => {
    if (!user) {
      setMessage("Please sign in first.");
      return;
    }
    if (!avatarFile) {
      setMessage("Choose an avatar image to upload.");
      return;
    }
    setLoading(true);
    setMessage("");
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setLoading(false);
      setMessage("Please sign in again.");
      return;
    }

    const formData = new FormData();
    formData.append("file", avatarFile);
    const res = await fetch("/api/avatars", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: formData,
    });
    const json = await res.json();
    if (!res.ok) {
      setLoading(false);
      setMessage(json.error || "Avatar upload failed.");
      return;
    }

    const publicUrl = json.url as string;
    setProfile((prev) => ({ ...prev, avatarUrl: publicUrl }));

    if (profileExists) {
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", user.id);
      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Avatar uploaded.");
      }
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold">Your Profile</h1>
          {isPaid ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-xs text-amber-900">
              <PaidStar className="h-3 w-3" />
              Paid subscriber{paidSource ? ` via ${paidSource}` : ""}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          Sign in with email or a Web3 wallet, then create your profile.
        </p>
      </div>

      {!session ? (
        <div className="space-y-4 rounded-xl border border-border bg-card p-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold">Email</label>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleEmailSignIn}
              className="rounded-lg border border-border bg-muted px-3 py-2 text-sm hover:bg-muted/70"
              disabled={loading || !email}
            >
              Send magic link
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Web3 Wallet</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleWeb3SignIn("ethereum")}
                className="rounded-lg border border-border bg-muted px-3 py-2 text-sm hover:bg-muted/70"
                disabled={loading}
              >
                Sign in with Ethereum
              </button>
              <button
                type="button"
                onClick={() => handleWeb3SignIn("solana")}
                className="rounded-lg border border-border bg-muted px-3 py-2 text-sm hover:bg-muted/70"
                disabled={loading}
              >
                Sign in with Solana
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <div>{user?.email ?? user?.id}</div>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted"
            >
              Sign out
            </button>
          </div>

          {meTools.length ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold">Profile Tools</div>
                <button
                  type="button"
                  onClick={() => setShowModuleCustomize((value) => !value)}
                  className="rounded-lg border border-border px-3 py-1 text-xs hover:bg-muted"
                >
                  {showModuleCustomize ? "Hide customization" : "Customize"}
                </button>
              </div>
              {showModuleCustomize ? (
                <div className="mt-3">
                  <ModuleViewsEditor
                    modules={meTools}
                    surface="me"
                    config={moduleViewConfig}
                    onChange={saveModuleViews}
                    onReset={resetModuleViews}
                    message={moduleViewMessage}
                  />
                </div>
              ) : null}
              <div className="mt-3">
                <ModuleSurfaceList
                  modules={meTools}
                  surface="me"
                  viewConfig={moduleViewConfig}
                />
              </div>
            </div>
          ) : null}
          {portalRoles.length ? (
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="text-sm font-semibold">Portal roles</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {portalRoles.map((role) => (
                  <span
                    key={role}
                    className="rounded-full border border-border px-3 py-1"
                  >
                    {role}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-background p-4">
                <div className="h-20 w-20 overflow-hidden rounded-full border border-border bg-muted">
                  {avatarPreview || profile.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarPreview ?? profile.avatarUrl}
                      alt="Profile avatar preview"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="font-semibold">Profile avatar</div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      setAvatarFile(event.target.files?.[0] ?? null)
                    }
                    className="text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAvatarUpload}
                    className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted"
                    disabled={loading}
                  >
                    Upload avatar
                  </button>
                </div>
              </div>
            </div>
            <label className="space-y-2 text-sm">
              <span className="font-semibold">Handle</span>
              <input
                value={profile.handle}
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    handle: event.target.value,
                  }))
                }
                placeholder="your-handle"
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-semibold">Display name</span>
              <input
                value={profile.displayName}
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    displayName: event.target.value,
                  }))
                }
                placeholder="Your name"
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              />
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span className="font-semibold">Bio</span>
              <textarea
                value={profile.bio}
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    bio: event.target.value,
                  }))
                }
                placeholder="Tell the cohort about you."
                className="min-h-[120px] w-full rounded-lg border border-border bg-background px-3 py-2"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-semibold">Location</span>
              <input
                value={profile.location}
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    location: event.target.value,
                  }))
                }
                placeholder="City, Country"
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-semibold">Wallet address</span>
              <input
                value={profile.walletAddress}
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    walletAddress: event.target.value,
                  }))
                }
                placeholder="0x..."
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              />
            </label>
            <div className="space-y-2 text-sm">
              <span className="font-semibold">Email to link</span>
              <div className="flex flex-wrap gap-2">
                <input
                  value={profile.email}
                  onChange={(event) =>
                    setProfile((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }))
                  }
                  placeholder="you@example.com"
                  className="w-full flex-1 rounded-lg border border-border bg-background px-3 py-2"
                />
                <button
                  type="button"
                  onClick={() => handleLinkEmail(profile.email)}
                  className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted"
                  disabled={linking}
                >
                  Link email
                </button>
              </div>
              {user?.email ? (
                <div className="text-xs text-muted-foreground">
                  Linked email: {user.email}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background p-4">
            <div className="space-y-4">
              <div>
                <div className="text-sm font-semibold">Skills</div>
                <p className="text-xs text-muted-foreground">
                  Select the skills you actively work with.
                </p>
              </div>
              <MultiSelect
                options={availableSkills}
                value={profile.skills}
                onChange={(skills) =>
                  setProfile((prev) => ({ ...prev, skills }))
                }
                emptyLabel="No skills available yet."
              />
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <div className="text-sm font-semibold">Roles</div>
                <p className="text-xs text-muted-foreground">
                  Select the roles that match how you contribute.
                </p>
              </div>
              <MultiSelect
                options={availableRoles}
                value={profile.roles}
                onChange={(roles) =>
                  setProfile((prev) => ({ ...prev, roles }))
                }
                emptyLabel="No roles available yet."
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleProfileSave}
              className="rounded-lg border border-border bg-primary px-4 py-2 text-sm text-background hover:opacity-90"
              disabled={loading}
            >
              {profileExists ? "Update profile" : "Create profile"}
            </button>
            {message ? (
              <span className="text-sm text-muted-foreground">{message}</span>
            ) : null}
          </div>

        </div>
      )}
    </div>
  );
}

function getWalletFromUser(user: User | null) {
  if (!user) return null;
  const meta = user.user_metadata as
    | {
        wallet_address?: string;
        address?: string;
        walletAddress?: string;
        custom_claims?: { address?: string };
      }
    | undefined;
  if (meta?.wallet_address) return meta.wallet_address;
  if (meta?.walletAddress) return meta.walletAddress;
  if (meta?.address) return meta.address;
  if (meta?.custom_claims?.address) return meta.custom_claims.address;

  const identities = user.identities ?? [];
  for (const identity of identities) {
    const data = identity?.identity_data as
      | {
          wallet_address?: string;
          address?: string;
          walletAddress?: string;
          custom_claims?: { address?: string };
        }
      | undefined;
    if (data?.wallet_address) return data.wallet_address;
    if (data?.walletAddress) return data.walletAddress;
    if (data?.address) return data.address;
    if (data?.custom_claims?.address) return data.custom_claims.address;
  }
  return null;
}

function MultiSelect({
  options,
  value,
  onChange,
  emptyLabel,
}: {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  emptyLabel: string;
}) {
  if (!options.length) {
    return <div className="text-xs text-muted-foreground">{emptyLabel}</div>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = value.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => {
              if (active) {
                onChange(value.filter((item) => item !== option));
              } else {
                onChange([...value, option]);
              }
            }}
            className={`rounded-full border px-3 py-1 text-xs ${
              active
                ? "border-primary bg-primary text-background"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
