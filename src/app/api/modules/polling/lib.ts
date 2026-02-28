import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";

export const POLL_ACTIONS = ["create", "vote", "view_results"] as const;
export const POLL_RULE_TYPES = ["authenticated", "role", "entitlement"] as const;
export const POLL_RESULTS_VISIBILITY = ["live", "after_close"] as const;

export type PollAction = (typeof POLL_ACTIONS)[number];
export type PollRuleType = (typeof POLL_RULE_TYPES)[number];
export type PollResultsVisibility = (typeof POLL_RESULTS_VISIBILITY)[number];

type QueryResult = { data: unknown; error: { message: string; code?: string } | null; count?: number | null };

export type UntypedQuery = {
  select: (...args: unknown[]) => UntypedQuery;
  insert: (...args: unknown[]) => UntypedQuery;
  update: (...args: unknown[]) => UntypedQuery;
  delete: (...args: unknown[]) => UntypedQuery;
  order: (...args: unknown[]) => UntypedQuery;
  limit: (...args: unknown[]) => UntypedQuery;
  eq: (...args: unknown[]) => UntypedQuery;
  neq: (...args: unknown[]) => UntypedQuery;
  in: (...args: unknown[]) => UntypedQuery;
  lt: (...args: unknown[]) => UntypedQuery;
  lte: (...args: unknown[]) => UntypedQuery;
  gt: (...args: unknown[]) => UntypedQuery;
  gte: (...args: unknown[]) => UntypedQuery;
  maybeSingle: () => Promise<QueryResult>;
  single: () => Promise<QueryResult>;
  then: PromiseLike<QueryResult>["then"];
};

type UntypedAdmin = {
  from: (table: string) => UntypedQuery;
};

export type PollViewer = {
  userId: string;
  roles: string[];
  entitlements: string[];
  admin: ReturnType<typeof supabaseAdminClient>;
};

export type PollRule = {
  id?: string;
  poll_id?: string;
  action: PollAction;
  rule_type: PollRuleType;
  rule_value: string | null;
};

export type PollRow = {
  id: string;
  title: string;
  description: string | null;
  created_by: string;
  opens_at: string;
  closes_at: string;
  status: "draft" | "open" | "closed";
  allow_vote_change: boolean;
  results_visibility: PollResultsVisibility;
  created_at: string;
  updated_at: string;
};

export function asUntypedAdmin(admin: ReturnType<typeof supabaseAdminClient>): UntypedAdmin {
  return admin as unknown as UntypedAdmin;
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function asTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function parseLimit(raw: string | null, fallback = 20, max = 50) {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

export function asIsoDate(value: unknown): string | null {
  const text = asTrimmed(value);
  if (!text) return null;
  const parsed = new Date(text);
  if (!Number.isFinite(parsed.valueOf())) return null;
  return parsed.toISOString();
}

export function isHost(viewer: Pick<PollViewer, "roles">) {
  return viewer.roles.includes("host") || viewer.roles.includes("admin");
}

export function stateForPoll(poll: Pick<PollRow, "status" | "opens_at" | "closes_at">, now: Date) {
  if (poll.status === "closed") return "closed" as const;
  const opensAt = new Date(poll.opens_at);
  const closesAt = new Date(poll.closes_at);
  if (now < opensAt) return "upcoming" as const;
  if (now > closesAt) return "closed" as const;
  return "open" as const;
}

export function evaluateEligibility(
  action: PollAction,
  rules: PollRule[],
  viewer: Pick<PollViewer, "userId" | "roles" | "entitlements">,
): boolean {
  const actionRules = rules.filter((rule) => rule.action === action);
  if (!actionRules.length) {
    return Boolean(viewer.userId);
  }

  return actionRules.some((rule) => {
    if (rule.rule_type === "authenticated") {
      return Boolean(viewer.userId);
    }
    if (rule.rule_type === "role") {
      return Boolean(rule.rule_value && viewer.roles.includes(rule.rule_value));
    }
    if (rule.rule_type === "entitlement") {
      return Boolean(rule.rule_value && viewer.entitlements.includes(rule.rule_value));
    }
    return false;
  });
}

export function parseRule(input: unknown): PollRule | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Record<string, unknown>;
  const action = asTrimmed(candidate.action);
  const ruleType = asTrimmed(candidate.rule_type);
  if (!action || !(POLL_ACTIONS as readonly string[]).includes(action)) {
    return null;
  }
  if (!ruleType || !(POLL_RULE_TYPES as readonly string[]).includes(ruleType)) {
    return null;
  }

  const rawValue = asTrimmed(candidate.rule_value);
  if (ruleType === "authenticated") {
    return {
      action: action as PollAction,
      rule_type: "authenticated",
      rule_value: null,
    };
  }

  if (!rawValue) {
    return null;
  }

  return {
    action: action as PollAction,
    rule_type: ruleType as PollRuleType,
    rule_value: rawValue,
  };
}

export async function requirePollViewer(
  request: NextRequest,
): Promise<{ error: string; status: number } | PollViewer> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Missing auth token.", status: 401 };
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = supabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return { error: "Invalid auth token.", status: 401 };
  }

  const admin = supabaseAdminClient();
  const userId = userData.user.id;
  const now = new Date().toISOString();

  const [rolesRes, entRes] = await Promise.all([
    admin.from("user_roles").select("role").eq("user_id", userId),
    admin
      .from("entitlements")
      .select("entitlement")
      .eq("user_id", userId)
      .eq("status", "active")
      .or(`expires_at.is.null,expires_at.gt.${now}`),
  ]);

  if (rolesRes.error) {
    return { error: `Failed to load roles: ${rolesRes.error.message}`, status: 500 };
  }
  if (entRes.error) {
    return { error: `Failed to load entitlements: ${entRes.error.message}`, status: 500 };
  }

  const roles = rolesRes.data?.map((row) => row.role) ?? [];
  const entitlements = entRes.data?.map((row) => row.entitlement) ?? [];

  return { userId, roles, entitlements, admin };
}

export function summarizePollCounts(options: Array<{ id: string }>, votes: Array<{ option_id: string }>) {
  const counts = new Map<string, number>();
  for (const option of options) {
    counts.set(option.id, 0);
  }
  for (const vote of votes) {
    counts.set(vote.option_id, (counts.get(vote.option_id) ?? 0) + 1);
  }
  return counts;
}
