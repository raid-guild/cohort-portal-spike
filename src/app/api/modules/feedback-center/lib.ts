import type { Json, TablesInsert, TablesUpdate } from "@/lib/types/db";

export const FEEDBACK_TYPES = ["bug", "feature", "feedback", "module_request"] as const;
export const FEEDBACK_STATUSES = ["new", "triaged", "in_progress", "done", "closed"] as const;
export const FEEDBACK_PRIORITIES = ["low", "medium", "high"] as const;

export type FeedbackType = (typeof FEEDBACK_TYPES)[number];
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export type FeedbackPriority = (typeof FEEDBACK_PRIORITIES)[number];

export type FeedbackItem = {
  id: string;
  type: FeedbackType;
  title: string;
  description_md: string;
  steps_to_reproduce_md: string | null;
  expected_result_md: string | null;
  actual_result_md: string | null;
  problem_md: string | null;
  proposed_outcome_md: string | null;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  module_id: string | null;
  route_path: string | null;
  reporter_user_id: string;
  assignee_user_id: string | null;
  triage_notes: string | null;
  browser_meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};

const ALLOWED_ITEM_QUERY_KEYS = ["mine", "type", "status", "priority", "q", "limit", "cursor"] as const;

export type FeedbackItemQuery = {
  mine: boolean;
  type: FeedbackType | null;
  status: FeedbackStatus | null;
  priority: FeedbackPriority | null;
  q: string | null;
  limit: number;
  cursor: string | null;
};

function asTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function asNullableTrimmed(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function asType(value: string | null): FeedbackType | null {
  if (!value) return null;
  if ((FEEDBACK_TYPES as readonly string[]).includes(value)) {
    return value as FeedbackType;
  }
  return null;
}

function asStatus(value: string | null): FeedbackStatus | null {
  if (!value) return null;
  if ((FEEDBACK_STATUSES as readonly string[]).includes(value)) {
    return value as FeedbackStatus;
  }
  return null;
}

function asPriority(value: string | null): FeedbackPriority | null {
  if (!value) return null;
  if ((FEEDBACK_PRIORITIES as readonly string[]).includes(value)) {
    return value as FeedbackPriority;
  }
  return null;
}

export function parseItemQuery(url: URL): FeedbackItemQuery {
  const known = new Set(ALLOWED_ITEM_QUERY_KEYS);
  for (const key of url.searchParams.keys()) {
    if (!known.has(key as (typeof ALLOWED_ITEM_QUERY_KEYS)[number])) {
      // ignore unknown keys by design
    }
  }

  const mine = url.searchParams.get("mine") !== "false";
  const type = asType(url.searchParams.get("type"));
  const status = asStatus(url.searchParams.get("status"));
  const priority = asPriority(url.searchParams.get("priority"));
  const q = asTrimmed(url.searchParams.get("q"));
  const limitRaw = Number(url.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.floor(limitRaw))) : 20;
  const cursor = asTrimmed(url.searchParams.get("cursor"));

  return { mine, type, status, priority, q, limit, cursor };
}

export type FeedbackCreateInput = {
  type?: unknown;
  title?: unknown;
  description_md?: unknown;
  steps_to_reproduce_md?: unknown;
  expected_result_md?: unknown;
  actual_result_md?: unknown;
  problem_md?: unknown;
  proposed_outcome_md?: unknown;
  module_id?: unknown;
  route_path?: unknown;
  browser_meta?: unknown;
};

export type FeedbackCreateValidated = TablesInsert<"feedback_items">;

export function validateCreateInput(
  body: FeedbackCreateInput,
  reporterUserId: string,
): { value?: FeedbackCreateValidated; error?: string } {
  const type = asType(asTrimmed(body.type));
  if (!type) {
    return { error: "type must be one of bug, feature, feedback, module_request." };
  }

  const title = asTrimmed(body.title);
  if (!title) {
    return { error: "title is required." };
  }

  const description = asTrimmed(body.description_md);
  if (!description) {
    return { error: "description_md is required." };
  }

  const steps = asNullableTrimmed(body.steps_to_reproduce_md);
  const expected = asNullableTrimmed(body.expected_result_md);
  const actual = asNullableTrimmed(body.actual_result_md);
  const problem = asNullableTrimmed(body.problem_md);
  const proposed = asNullableTrimmed(body.proposed_outcome_md);

  if (type === "bug" && (!steps || !expected || !actual)) {
    return { error: "bug reports require steps_to_reproduce_md, expected_result_md, and actual_result_md." };
  }

  if ((type === "feature" || type === "module_request") && (!problem || !proposed)) {
    return { error: "feature and module_request reports require problem_md and proposed_outcome_md." };
  }

  const insert: FeedbackCreateValidated = {
    type,
    title,
    description_md: description,
    steps_to_reproduce_md: steps,
    expected_result_md: expected,
    actual_result_md: actual,
    problem_md: problem,
    proposed_outcome_md: proposed,
    module_id: asNullableTrimmed(body.module_id),
    route_path: asNullableTrimmed(body.route_path),
    reporter_user_id: reporterUserId,
    browser_meta:
      body.browser_meta && typeof body.browser_meta === "object"
        ? (JSON.parse(JSON.stringify(body.browser_meta)) as Json)
        : null,
  };

  return { value: insert };
}

export type FeedbackReporterPatchInput = {
  title?: unknown;
  description_md?: unknown;
  steps_to_reproduce_md?: unknown;
  expected_result_md?: unknown;
  actual_result_md?: unknown;
  problem_md?: unknown;
  proposed_outcome_md?: unknown;
  module_id?: unknown;
  route_path?: unknown;
};

export function validateReporterPatch(
  body: FeedbackReporterPatchInput,
  existingType: FeedbackType,
): { value?: TablesUpdate<"feedback_items">; error?: string } {
  const update: TablesUpdate<"feedback_items"> = {};

  if (Object.prototype.hasOwnProperty.call(body, "title")) {
    const title = asTrimmed(body.title);
    if (!title) return { error: "title cannot be empty." };
    update.title = title;
  }

  if (Object.prototype.hasOwnProperty.call(body, "description_md")) {
    const description = asTrimmed(body.description_md);
    if (!description) return { error: "description_md cannot be empty." };
    update.description_md = description;
  }

  if (Object.prototype.hasOwnProperty.call(body, "steps_to_reproduce_md")) {
    update.steps_to_reproduce_md = asNullableTrimmed(body.steps_to_reproduce_md);
  }
  if (Object.prototype.hasOwnProperty.call(body, "expected_result_md")) {
    update.expected_result_md = asNullableTrimmed(body.expected_result_md);
  }
  if (Object.prototype.hasOwnProperty.call(body, "actual_result_md")) {
    update.actual_result_md = asNullableTrimmed(body.actual_result_md);
  }
  if (Object.prototype.hasOwnProperty.call(body, "problem_md")) {
    update.problem_md = asNullableTrimmed(body.problem_md);
  }
  if (Object.prototype.hasOwnProperty.call(body, "proposed_outcome_md")) {
    update.proposed_outcome_md = asNullableTrimmed(body.proposed_outcome_md);
  }
  if (Object.prototype.hasOwnProperty.call(body, "module_id")) {
    update.module_id = asNullableTrimmed(body.module_id);
  }
  if (Object.prototype.hasOwnProperty.call(body, "route_path")) {
    update.route_path = asNullableTrimmed(body.route_path);
  }

  const type = existingType;
  const steps = (update.steps_to_reproduce_md as string | null | undefined) ?? undefined;
  const expected = (update.expected_result_md as string | null | undefined) ?? undefined;
  const actual = (update.actual_result_md as string | null | undefined) ?? undefined;
  const problem = (update.problem_md as string | null | undefined) ?? undefined;
  const proposed = (update.proposed_outcome_md as string | null | undefined) ?? undefined;

  if (type === "bug" && (steps === null || expected === null || actual === null)) {
    return { error: "bug reports require steps_to_reproduce_md, expected_result_md, and actual_result_md." };
  }
  if ((type === "feature" || type === "module_request") && (problem === null || proposed === null)) {
    return { error: "feature and module_request reports require problem_md and proposed_outcome_md." };
  }

  return { value: update };
}

export type FeedbackHostPatchInput = {
  status?: unknown;
  priority?: unknown;
  assignee_user_id?: unknown;
  triage_notes?: unknown;
};

export function validateHostPatch(
  body: FeedbackHostPatchInput,
): { value?: TablesUpdate<"feedback_items">; error?: string } {
  const update: TablesUpdate<"feedback_items"> = {};

  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    const status = asStatus(asTrimmed(body.status));
    if (!status) return { error: "status must be one of new, triaged, in_progress, done, closed." };
    update.status = status;
    update.closed_at = status === "closed" ? new Date().toISOString() : null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "priority")) {
    const priority = asPriority(asTrimmed(body.priority));
    if (!priority) return { error: "priority must be one of low, medium, high." };
    update.priority = priority;
  }

  if (Object.prototype.hasOwnProperty.call(body, "assignee_user_id")) {
    const assignee = asNullableTrimmed(body.assignee_user_id);
    update.assignee_user_id = assignee;
  }

  if (Object.prototype.hasOwnProperty.call(body, "triage_notes")) {
    update.triage_notes = asNullableTrimmed(body.triage_notes);
  }

  return { value: update };
}
