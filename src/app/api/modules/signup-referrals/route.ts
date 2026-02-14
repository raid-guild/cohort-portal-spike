import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parseLimit(value: string | null) {
  const parsed = Number(value ?? "");
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.trunc(parsed), MAX_LIMIT);
}

function parseCursor(value: string | null) {
  const parsed = Number(value ?? "");
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.trunc(parsed);
}

async function requireHostOrAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false as const, status: 401 as const, error: "Missing auth token." };
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = supabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    return { ok: false as const, status: 401 as const, error: "Invalid auth token." };
  }

  const admin = supabaseAdminClient();
  const { data: roleRows, error: roleError } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);

  if (roleError) {
    return { ok: false as const, status: 500 as const, error: roleError.message };
  }

  const roles = roleRows?.map((row) => row.role) ?? [];
  const allowed = roles.includes("host") || roles.includes("admin");
  if (!allowed) {
    return { ok: false as const, status: 403 as const, error: "Host role required." };
  }

  return { ok: true as const, admin, userId: userData.user.id };
}

function escapeLike(value: string) {
  // Escape LIKE/ILIKE wildcards and the escape character itself.
  // Postgres treats '%' as multi-char wildcard and '_' as single-char wildcard.
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

export async function GET(request: NextRequest) {
  const gate = await requireHostOrAdmin(request);
  if (!gate.ok) {
    return Response.json({ error: gate.error }, { status: gate.status });
  }

  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const cursor = parseCursor(url.searchParams.get("cursor"));
  const q = url.searchParams.get("q")?.trim() ?? "";
  const rawStatus = (url.searchParams.get("status") ?? "all").toLowerCase();
  const allowedStatuses = ["all", "converted", "not_converted"] as const;

  if (!allowedStatuses.includes(rawStatus as (typeof allowedStatuses)[number])) {
    return Response.json(
      { error: `Invalid status. Expected one of: ${allowedStatuses.join(", ")}.` },
      { status: 400 },
    );
  }

  const status = rawStatus as (typeof allowedStatuses)[number];
  const admin = gate.admin;

  // Note: uses offset pagination for a minimal MVP.
  // We apply the status filter in SQL so pagination and nextCursor are consistent.
  const safeQ = q ? escapeLike(q) : "";
  const pageSize = limit + 1;

  const { data, error } = await (admin as unknown as { rpc: Function }).rpc("signup_referrals_list", {
    p_limit: pageSize,
    p_offset: cursor,
    p_q: safeQ,
    p_status: status,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Array<{
    id: string;
    email: string;
    referral: string | null;
    created_at: string | null;
    has_account: boolean;
  }>;

  const hasMore = rows.length > limit;
  const slice = rows.slice(0, limit);

  const mapped = slice.map((row) => ({
    id: row.id,
    email: row.email,
    referral: row.referral,
    createdAt: row.created_at,
    hasAccount: row.has_account,
  }));

  const nextCursor = hasMore ? String(cursor + limit) : null;

  return Response.json({ items: mapped, nextCursor });
}
