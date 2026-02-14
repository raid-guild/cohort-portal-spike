import type { Json } from "@/lib/types/db";

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

  const ownerLine =
    (typeof ownerContact === "string" ? ownerContact.trim() : "") ||
    (typeof spec.owner === "string" ? spec.owner.trim() : "") ||
    "_No response_";

  return [
    `### Module ID\n\n${moduleId}\n`,
    `### Title\n\n${title}\n`,
    `### Owner / contact\n\n${ownerLine}\n`,
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

  return allowed.includes(value as ModuleRequestStatus) ? (value as ModuleRequestStatus) : null;
}
