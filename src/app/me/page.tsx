"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { ModuleSurfaceList } from "@/components/ModuleSurfaceList";
import { ModuleViewsEditor } from "@/components/ModuleViewsEditor";
import { RolePicker } from "@/components/RolePicker";
import type { ModuleEntry } from "@/lib/types";
import type { ModuleViewsConfig } from "@/lib/module-views";
import { PaidStar } from "@/components/PaidStar";
import { RAID_GUILD_ROLES } from "@/lib/raidguild-roles";

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
  const [linking, setLinking] = useState(false);
  const [meTools, setMeTools] = useState<ModuleEntry[]>([]);
  const [portalRoles, setPortalRoles] = useState<string[]>([]);
  const [isPaid, setIsPaid] = useState(false);
  const [paidSource, setPaidSource] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [showModuleCustomize, setShowModuleCustomize] = useState(false);
  const [moduleViewConfig, setModuleViewConfig] = useState<ModuleViewsConfig | null>(
    null,
  );
  const [moduleViewMessage, setModuleViewMessage] = useState("");
  const autosaveTimer = useRef<number | null>(null);

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
    const loadModuleViews = async () => {
      try {
        const { data, error } = await supabase
          .from("module_data")
          .select("payload")
          .eq("module_id", "module-views")
          .eq("user_id", user.id)
          .maybeSingle();
        if (cancelled) return;
        if (error || !data?.payload) {
          setModuleViewConfig(null);
          return;
        }
        setModuleViewConfig(data.payload as ModuleViewsConfig);
      } catch {
        if (cancelled) return;
        setModuleViewConfig(null);
        setModuleViewMessage("Unable to load saved module views.");
      }
    };
    void loadModuleViews();
    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

  const saveModuleViews = useCallback(
    async (nextConfig: ModuleViewsConfig) => {
      setModuleViewConfig(nextConfig);
      setModuleViewMessage("Saving...");
      if (!user) {
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
        setModuleViewMessage(error.message);
        return;
      }
      setModuleViewMessage("Saved.");
    },
    [supabase, user],
  );

  const resetModuleViews = useCallback(async () => {
    setModuleViewConfig(null);
    setModuleViewMessage("Resetting...");
    if (!user) {
      setModuleViewMessage("Sign in to reset module views.");
      return;
    }
    const { error } = await supabase
      .from("module_data")
      .delete()
      .eq("module_id", "module-views")
      .eq("user_id", user.id);
    if (error) {
      setModuleViewMessage(error.message);
      return;
    }
    setModuleViewMessage("Reset to defaults.");
  }, [supabase, user]);

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

  const rolesLimit = 2;
  const isProfileComplete =
    Boolean(profile.handle.trim()) &&
    Boolean(profile.displayName.trim()) &&
    Boolean(profile.bio.trim()) &&
    profile.roles.length > 0 &&
    profile.roles.length <= rolesLimit &&
    profile.skills.length > 0;
  const showWizard = Boolean(session) && wizardOpen;

  const wizardSteps = [
    {
      title: "Basics",
      valid:
        Boolean(profile.handle.trim()) &&
        Boolean(profile.displayName.trim()) &&
        Boolean(profile.bio.trim()),
    },
    {
      title: "Skills",
      valid: profile.skills.length > 0,
    },
    {
      title: "Roles",
      valid: profile.roles.length > 0 && profile.roles.length <= rolesLimit,
    },
  ];

  const wizardIsValid = wizardSteps.every((step) => step.valid);
  const wizardCanAdvance = wizardSteps[wizardStep]?.valid ?? false;
  const roleSuggestions = inferRoleSuggestions(profile.skills, RAID_GUILD_ROLES);

  useEffect(() => {
    if (!session) {
      setWizardOpen(false);
      return;
    }
    if (!profileExists || !isProfileComplete) {
      setWizardOpen(true);
      return;
    }
    setWizardOpen(false);
  }, [isProfileComplete, profileExists, session]);

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

  const handleProfileSave = useCallback(async (options?: { silent?: boolean }) => {
    if (!user) {
      if (!options?.silent) {
        setMessage("Please sign in first.");
      }
      return false;
    }

    const trimmedHandle = profile.handle.trim();
    if (!trimmedHandle) {
      if (!options?.silent) {
        setMessage("Handle is required.");
      }
      return false;
    }
    if (!/^[a-z0-9_-]+$/i.test(trimmedHandle)) {
      if (!options?.silent) {
        setMessage("Handle can only use letters, numbers, hyphens, and underscores.");
      }
      return false;
    }
    if (!profile.displayName.trim()) {
      if (!options?.silent) {
        setMessage("Name is required.");
      }
      return false;
    }
    if (!profile.bio.trim()) {
      if (!options?.silent) {
        setMessage("Description is required.");
      }
      return false;
    }
    if (!profile.roles.length) {
      if (!options?.silent) {
        setMessage("Select at least one role.");
      }
      return false;
    }
    if (profile.roles.length > rolesLimit) {
      if (!options?.silent) {
        setMessage(`Select up to ${rolesLimit} roles.`);
      }
      return false;
    }
    if (!profile.skills.length) {
      if (!options?.silent) {
        setMessage("Select at least one skill.");
      }
      return false;
    }

    setLoading(true);
    if (!options?.silent) {
      setMessage("");
    }
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
    if (!options?.silent) {
      setMessage(error ? error.message : "Profile saved.");
    } else if (error) {
      setMessage(error.message);
    }
    if (!error) {
      setProfileExists(true);
      setWizardOpen(false);
      setWizardStep(0);
      window.localStorage.setItem("profile-updated", new Date().toISOString());
      window.postMessage({ type: "profile-updated" }, window.location.origin);
    }
    return !error;
  }, [profile, profileExists, supabase, user]);

  useEffect(() => {
    if (!session) return;
    if (!isProfileComplete) return;
    if (autosaveTimer.current) {
      window.clearTimeout(autosaveTimer.current);
    }
    autosaveTimer.current = window.setTimeout(() => {
      handleProfileSave({ silent: true }).catch(() => null);
    }, 800);
    return () => {
      if (autosaveTimer.current) {
        window.clearTimeout(autosaveTimer.current);
      }
    };
  }, [handleProfileSave, isProfileComplete, profile, session]);

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
      {showWizard ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Profile setup
                </div>
                <h2 className="text-2xl font-semibold">Complete your profile</h2>
              </div>
              <div className="text-xs text-muted-foreground">
                Step {wizardStep + 1} of {wizardSteps.length}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {wizardSteps.map((step, index) => (
                <div
                  key={step.title}
                  className={`rounded-full border px-3 py-1 ${
                    index === wizardStep
                      ? "border-primary text-foreground"
                      : step.valid
                        ? "border-emerald-500/40 text-emerald-200"
                        : "border-border"
                  }`}
                >
                  {step.title}
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-4">
              {wizardStep === 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm md:col-span-2">
                    <span className="font-semibold">Discord handle</span>
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
                  <label className="space-y-2 text-sm md:col-span-2">
                    <span className="font-semibold">Name</span>
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
                    <span className="font-semibold">Description</span>
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
                </div>
              ) : null}

              {wizardStep === 1 ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-semibold">Skills</div>
                    <p className="text-xs text-muted-foreground">
                      Skills are broader than roles. You can list skills even if they
                      aren’t your primary role.
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
              ) : null}

              {wizardStep === 2 ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-semibold">Choose your roles</div>
                    <p className="text-xs text-muted-foreground">
                      Based on your skills, we’ve suggested roles below. You can adjust.
                    </p>
                  </div>
                  {roleSuggestions.length ? (
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {roleSuggestions.map((role) => (
                        <span
                          key={role}
                          className="rounded-full border border-border px-3 py-1"
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <RolePicker
                    roles={RAID_GUILD_ROLES}
                    value={profile.roles}
                    onChange={(roles) =>
                      setProfile((prev) => ({ ...prev, roles }))
                    }
                    maxSelected={rolesLimit}
                  />
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                {message ? message : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {wizardStep > 0 ? (
                  <button
                    type="button"
                    onClick={() => setWizardStep((step) => Math.max(0, step - 1))}
                    className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted"
                  >
                    Back
                  </button>
                ) : null}
                {wizardStep < wizardSteps.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!wizardCanAdvance) {
                        setMessage("Complete this step to continue.");
                        return;
                      }
                      setMessage("");
                      if (wizardStep === 1 && profile.roles.length === 0) {
                        const suggestions = roleSuggestions.slice(0, rolesLimit);
                        if (suggestions.length) {
                          setProfile((prev) => ({ ...prev, roles: suggestions }));
                        }
                      }
                      setWizardStep((step) => Math.min(step + 1, wizardSteps.length - 1));
                    }}
                    className="rounded-lg border border-border bg-primary px-3 py-2 text-xs text-background hover:opacity-90"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!wizardIsValid) {
                        setMessage("Complete all required fields.");
                        return;
                      }
                      const ok = await handleProfileSave();
                      if (ok) {
                        setMessage("");
                      }
                    }}
                    className="rounded-lg border border-border bg-primary px-3 py-2 text-xs text-background hover:opacity-90"
                    disabled={loading}
                  >
                    Finish &amp; Save
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
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
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setWizardOpen(true)}
                    className="rounded-lg border border-border px-3 py-1 text-xs hover:bg-muted"
                  >
                    Open profile wizard
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModuleCustomize((value) => !value)}
                    className="rounded-lg border border-border px-3 py-1 text-xs hover:bg-muted"
                  >
                    {showModuleCustomize ? "Hide customization" : "Customize"}
                  </button>
                </div>
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
                readOnly
                placeholder="0x..."
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-muted-foreground"
              />
              <div className="text-xs text-muted-foreground">
                Wallet addresses are linked by signing a message.
              </div>
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
                  Select the roles that match how you contribute. Choose up to two.
                </p>
              </div>
              <RolePicker
                roles={RAID_GUILD_ROLES}
                value={profile.roles}
                onChange={(roles) =>
                  setProfile((prev) => ({ ...prev, roles }))
                }
                maxSelected={rolesLimit}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                void handleProfileSave();
              }}
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

function inferRoleSuggestions(
  skills: string[],
  roles: { name: string; type: string }[],
) {
  const normalizedSkills = skills.map((skill) => skill.toLowerCase());
  const scored = roles.map((role) => {
    const keywords = new Set(
      `${role.name} ${role.type}`
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .filter((token) => token.length >= 3),
    );
    let score = 0;
    normalizedSkills.forEach((skill) => {
      keywords.forEach((keyword) => {
        if (skill.includes(keyword)) {
          score += 1;
        }
      });
    });
    return { name: role.name, score };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.name);
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
