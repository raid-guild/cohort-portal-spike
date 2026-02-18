import { NextRequest } from "next/server";
import { requireHost } from "./_auth";

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

function escapeLike(value: string) {
  // Escape LIKE/ILIKE wildcards and the escape character itself.
  // Postgres treats '%' as multi-char wildcard and '_' as single-char wildcard.
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

export async function GET(request: NextRequest) {
  try {
    const gate = await requireHost(request);
    if ("error" in gate) {
      return Response.json({ error: gate.error }, { status: gate.status ?? 500 });
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

    const { data, error } = await admin.rpc("signup_referrals_list", {
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
  } catch (err) {
    const message =
      typeof err === "string" ? err : err instanceof Error ? err.message : "Internal server error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
