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

  let query = admin
    .from("email_referrals")
    .select("id,email,referral,created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (q) {
    const safe = q.replaceAll("%", "\\%");
    query = query.or(`email.ilike.%${safe}%,referral.ilike.%${safe}%`);
  }

  // Note: uses offset pagination for a minimal MVP.
  // Supabase range is inclusive, so request limit+1 to detect if there's another page.
  query = query.range(cursor, cursor + limit);

  const { data: rows, error } = await query;
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const rawItems = (rows ?? []) as ReferralRow[];
  const hasMore = rawItems.length > limit;
  const items = rawItems.slice(0, limit);

  const emails = Array.from(new Set(items.map((row) => normalizeEmail(row.email))));

  const { data: profileRows, error: profileError } = await admin
    .from("profiles")
    .select("email")
    .in("email", emails);

  if (profileError) {
    return Response.json({ error: profileError.message }, { status: 500 });
  }

  const hasAccountByEmail = new Set(
    (profileRows ?? [])
      .map((row) => (row.email ? normalizeEmail(row.email) : null))
      .filter((value): value is string => Boolean(value)),
  );

  const mapped = items
    .map((row) => {
      const hasAccount = hasAccountByEmail.has(normalizeEmail(row.email));
      return {
        id: row.id,
        email: row.email,
        referral: row.referral,
        createdAt: row.created_at,
        hasAccount,
      };
    })
    .filter((row) => {
      if (status === "converted") return row.hasAccount;
      if (status === "not_converted") return !row.hasAccount;
      return true;
    });

  const nextCursor = hasMore ? String(cursor + limit) : null;

  return Response.json({ items: mapped, nextCursor });
}
