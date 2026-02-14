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

type ReferralRow = {
  id: string;
  email: string;
  referral: string | null;
  created_at: string | null;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
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
  const status = (url.searchParams.get("status") ?? "all").toLowerCase();

  const admin = gate.admin;

  let baseQuery = admin
    .from("email_referrals")
    .select("id,email,referral,created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (q) {
    const safe = escapeLike(q);
    baseQuery = baseQuery.or(`email.ilike.%${safe}%,referral.ilike.%${safe}%`);
  }

  // Note: uses offset pagination for a minimal MVP.
  // When filtering by status, we scan forward until we've filled a page so
  // pagination stays consistent with the filter.
  const chunkSize = limit;
  let scanCursor = cursor;
  let hasMore = false;
  const mapped: Array<{
    id: string;
    email: string;
    referral: string | null;
    createdAt: string | null;
    hasAccount: boolean;
  }> = [];

  while (mapped.length < limit) {
    const { data: rows, error } = await baseQuery.range(scanCursor, scanCursor + chunkSize - 1);
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    const batch = (rows ?? []) as ReferralRow[];
    if (batch.length === 0) {
      hasMore = false;
      break;
    }

    const emails = Array.from(new Set(batch.map((row) => normalizeEmail(row.email))));

    let profileRows: Array<{ email: string | null }> = [];
    if (emails.length > 0) {
      const emailsOr = emails.map((email) => `email.ilike.${escapeLike(email)}`).join(",");
      const { data, error: profileError } = await admin.from("profiles").select("email").or(emailsOr);
      if (profileError) {
        return Response.json({ error: profileError.message }, { status: 500 });
      }
      profileRows = (data ?? []) as Array<{ email: string | null }>;
    }

    const hasAccountByEmail = new Set(
      profileRows
        .map((row) => (row.email ? normalizeEmail(row.email) : null))
        .filter((value): value is string => Boolean(value)),
    );

    let processed = 0;
    for (let i = 0; i < batch.length; i += 1) {
      const row = batch[i];
      const hasAccount = hasAccountByEmail.has(normalizeEmail(row.email));
      const next = {
        id: row.id,
        email: row.email,
        referral: row.referral,
        createdAt: row.created_at,
        hasAccount,
      };

      const matchesStatus =
        status === "all" || (status === "converted" ? next.hasAccount : !next.hasAccount);

      if (matchesStatus) {
        mapped.push(next);
        if (mapped.length >= limit) {
          processed = i + 1;
          break;
        }
      }

      processed = i + 1;
    }

    scanCursor += processed;

    // If we stopped early (page filled), or the batch was full-sized, there may be more data.
    if (mapped.length >= limit) {
      hasMore = processed < batch.length || batch.length === chunkSize;
      break;
    }

    if (batch.length < chunkSize) {
      hasMore = false;
      break;
    }

    hasMore = true;
  }

  const nextCursor = hasMore ? String(scanCursor) : null;

  return Response.json({ items: mapped, nextCursor });
}
