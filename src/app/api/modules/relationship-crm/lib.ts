import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";

export const RELATIONSHIP_TYPES = ["sponsor", "agency-client", "partner", "other"] as const;
export const ACCOUNT_STAGES = [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
  "active",
  "paused",
  "closed-won",
  "closed-lost",
] as const;
export const ACCOUNT_STATUSES = ["active", "inactive"] as const;
export const CONTACT_CHANNELS = ["email", "discord", "telegram", "phone", "other"] as const;
export const INTERACTION_TYPES = ["note", "email", "call", "meeting", "other"] as const;
export const TASK_STATUSES = ["open", "done", "canceled"] as const;

export type CrmViewer = {
  userId: string;
  roles: string[];
  entitlements: string[];
  admin: ReturnType<typeof supabaseAdminClient>;
};

export type CrmProfile = {
  user_id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
};

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function asNullableTimestamp(value: unknown): string | null {
  if (value === null) return null;
  const str = asString(value);
  if (!str) return null;
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function asBoolean(value: unknown, defaultValue = false): boolean {
  if (typeof value === "boolean") return value;
  return defaultValue;
}

export function includesValue<const T extends readonly string[]>(
  value: string | null,
  values: T,
): value is T[number] {
  return Boolean(value && values.includes(value));
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function parseLimit(raw: string | null, fallback = 50, max = 100) {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

export async function requireCrmAccess(
  request: NextRequest,
): Promise<{ error: string; status: number } | CrmViewer> {
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
      .eq("entitlement", "dao-member")
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
  const allowed = roles.includes("host") || roles.includes("admin") || entitlements.includes("dao-member");

  if (!allowed) {
    return { error: "Host role or active dao-member entitlement required.", status: 403 };
  }

  return { userId, roles, entitlements, admin };
}

export async function accountExists(admin: ReturnType<typeof supabaseAdminClient>, accountId: string) {
  const { data, error } = await admin
    .from("relationship_crm_accounts")
    .select("id")
    .eq("id", accountId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function loadCrmProfileMap(
  admin: ReturnType<typeof supabaseAdminClient>,
  userIds: string[],
) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  const profileByUserId = new Map<string, CrmProfile>();
  if (!uniqueUserIds.length) {
    return profileByUserId;
  }

  const { data, error } = await admin
    .from("profiles")
    .select("user_id,handle,display_name,avatar_url")
    .in("user_id", uniqueUserIds);

  if (error) {
    throw new Error(error.message);
  }

  for (const profile of (data ?? []) as CrmProfile[]) {
    if (profile.user_id) {
      profileByUserId.set(profile.user_id, profile);
    }
  }

  return profileByUserId;
}
