import type { Json } from "@/lib/types/db";
import { supabaseAdminClient } from "@/lib/supabase/admin";

export type ModuleRequestStatus =
  | "draft"
  | "open"
  | "ready"
  | "submitted_to_github"
  | "archived";

export type ModuleRequestSpec = {
  module_id?: string;
  owner?: string;
  problem?: string;
  scope?: string;
  ux?: string;
  storage?: string;
  data_model?: string;
  api?: string;
  acceptance?: string;
  testing?: string;
  portal_rpc?: string;
  allowed_origins?: string;
  [key: string]: Json | undefined;
};

export function toGitHubIssueMarkdown(params: {
  title: string;
  moduleId: string;
  ownerContact?: string | null;
  spec: ModuleRequestSpec;
}): string {
  const { title, moduleId, ownerContact, spec } = params;

  const section = (heading: string, value?: unknown) => {
    const text = typeof value === "string" ? value.trim() : "";
    return `### ${heading}\n\n${text || "_No response_"}\n`;
  };

  return [
    `### Module ID\n\n${moduleId}\n`,
    `### Title\n\n${title}\n`,
    `### Owner / contact\n\n${ownerContact || spec.owner || "_No response_"}\n`,
    section("Problem / user value", spec.problem),
    section("Scope (what’s in / out)", spec.scope),
    section("UX / surfaces", spec.ux),
    section("Storage preference", spec.storage),
    section("Data model (fields)", spec.data_model),
    section("API requirements", spec.api),
    section("Acceptance criteria", spec.acceptance),
    section("Testing / seed data", spec.testing),
    section("Portal RPC (optional)", spec.portal_rpc),
    section("Allowed iframe origins (optional)", spec.allowed_origins),
  ].join("\n");
}

export function normalizeStatus(input: unknown): ModuleRequestStatus | null {
  const value = typeof input === "string" ? input.trim() : "";
  const allowed: ModuleRequestStatus[] = [
    "draft",
    "open",
    "ready",
    "submitted_to_github",
    "archived",
  ];
  return (allowed as string[]).includes(value) ? (value as ModuleRequestStatus) : null;
}

type ModuleRequestAuthor = {
  user_id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
};

type ModuleRequestRow = {
  created_by: string;
  [key: string]: unknown;
};

export async function withModuleRequestAuthors<T extends ModuleRequestRow>(
  admin: ReturnType<typeof supabaseAdminClient>,
  items: T[],
): Promise<Array<T & { author: ModuleRequestAuthor | null }>> {
  const userIds = Array.from(new Set(items.map((item) => item.created_by).filter(Boolean)));
  const authorByUserId = new Map<string, ModuleRequestAuthor>();

  if (userIds.length) {
    const { data: profiles, error } = await admin
      .from("profiles")
      .select("user_id,handle,display_name,avatar_url")
      .in("user_id", userIds);

    if (error) {
      throw new Error(error.message);
    }

    for (const profile of (profiles ?? []) as ModuleRequestAuthor[]) {
      if (profile.user_id) {
        authorByUserId.set(profile.user_id, profile);
      }
    }
  }

  return items.map((item) => ({
    ...item,
    author: authorByUserId.get(item.created_by) ?? null,
  }));
}
