"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import type { ModuleRequest } from "./types";

type Spec = {
  problem: string;
  scope: string;
  ux: string;
  storage: string;
  data_model: string;
  api: string;
  acceptance: string;
  testing: string;
  portal_rpc: string;
  allowed_origins: string;
};

const emptySpec: Spec = {
  problem: "",
  scope: "",
  ux: "",
  storage: "module_data (per-user JSON)",
  data_model: "",
  api: "",
  acceptance: "",
  testing: "",
  portal_rpc: "",
  allowed_origins: "",
};

export function ModuleRequestCreateForm() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [ownerContact, setOwnerContact] = useState("");
  const [spec, setSpec] = useState<Spec>(emptySpec);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveDraft = async () => {
    setSaving(true);
    setError(null);

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        throw new Error("You must be signed in.");
      }

      const res = await fetch("/api/modules/module-requests", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          module_id: moduleId,
          owner_contact: ownerContact || null,
          spec,
        }),
      });

      const json = (await res.json()) as { request?: ModuleRequest; error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to create request.");
      }

      const requestId = json.request?.id;
      if (!requestId) {
        throw new Error("Missing request id.");
      }

      router.push(`/modules/module-requests/${requestId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create request.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/modules/module-requests"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back
        </Link>
        <button
          type="button"
          onClick={() => saveDraft()}
          disabled={saving}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save draft"}
        </button>
      </div>

      {error ? <div className="text-sm text-red-500">{error}</div> : null}

      <div className="grid gap-3 rounded-xl border border-border bg-card p-4">
        <label className="grid gap-1 text-sm">
          <span className="text-xs text-muted-foreground">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            className="h-10 rounded-lg border border-border bg-background px-3"
            placeholder="Short label for lists"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-xs text-muted-foreground">Suggested module_id</span>
          <input
            value={moduleId}
            onChange={(e) => setModuleId(e.target.value)}
            maxLength={64}
            className="h-10 rounded-lg border border-border bg-background px-3"
            placeholder="kebab-case (e.g. module-requests)"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-xs text-muted-foreground">Owner / contact</span>
          <input
            value={ownerContact}
            onChange={(e) => setOwnerContact(e.target.value)}
            maxLength={256}
            className="h-10 rounded-lg border border-border bg-background px-3"
            placeholder="discord:@you"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <TextArea
            label="Problem / user value"
            required
            value={spec.problem}
            onChange={(v) => setSpec((s) => ({ ...s, problem: v }))}
          />
          <TextArea
            label="Scope (what’s in / out)"
            required
            value={spec.scope}
            onChange={(v) => setSpec((s) => ({ ...s, scope: v }))}
          />
          <TextArea
            label="UX / surfaces"
            required
            value={spec.ux}
            onChange={(v) => setSpec((s) => ({ ...s, ux: v }))}
          />
          <TextArea
            label="Storage preference"
            value={spec.storage}
            onChange={(v) => setSpec((s) => ({ ...s, storage: v }))}
          />
          <TextArea
            label="Data model"
            value={spec.data_model}
            onChange={(v) => setSpec((s) => ({ ...s, data_model: v }))}
          />
          <TextArea
            label="API requirements"
            value={spec.api}
            onChange={(v) => setSpec((s) => ({ ...s, api: v }))}
          />
          <TextArea
            label="Acceptance criteria"
            value={spec.acceptance}
            onChange={(v) => setSpec((s) => ({ ...s, acceptance: v }))}
          />
          <TextArea
            label="Testing / seed data"
            value={spec.testing}
            onChange={(v) => setSpec((s) => ({ ...s, testing: v }))}
          />
          <TextArea
            label="Portal RPC (optional)"
            value={spec.portal_rpc}
            onChange={(v) => setSpec((s) => ({ ...s, portal_rpc: v }))}
          />
          <TextArea
            label="Allowed iframe origins (optional)"
            value={spec.allowed_origins}
            onChange={(v) => setSpec((s) => ({ ...s, allowed_origins: v }))}
          />
        </div>

        <div className="text-xs text-muted-foreground">
          Drafts are private to you until you publish.
        </div>
      </div>
    </div>
  );
}

function TextArea({
  label,
  required,
  value,
  onChange,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-xs text-muted-foreground">
        {label}
        {required ? " *" : ""}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-24 rounded-lg border border-border bg-background p-3"
        placeholder={required ? "Required" : "Optional"}
      />
    </label>
  );
}
