import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";

type ReferralRow = {
  id: string;
  email: string;
  referral: string | null;
  created_at: string | null;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
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

  return { ok: true as const, admin };
}

function csvEscape(value: string) {
  if (value.includes("\n") || value.includes("\r") || value.includes(",") || value.includes('"')) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export async function POST(request: NextRequest) {
  const gate = await requireHostOrAdmin(request);
  if (!gate.ok) {
    return Response.json({ error: gate.error }, { status: gate.status });
  }

  let body: { ids?: unknown };
  try {
    body = (await request.json()) as { ids?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const ids = Array.isArray(body.ids) ? body.ids.map((id) => String(id)) : [];
  if (!ids.length) {
    return Response.json({ error: "ids is required." }, { status: 400 });
  }

  const admin = gate.admin;
  const { data: rows, error } = await admin
    .from("email_referrals")
    .select("id,email,referral,created_at")
    .in("id", ids);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const items = (rows ?? []) as ReferralRow[];
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

  const lines: string[] = [];
  lines.push(["email", "referral", "created_at", "has_account"].join(","));

  for (const row of items) {
    const hasAccount = hasAccountByEmail.has(normalizeEmail(row.email));
    lines.push(
      [
        csvEscape(row.email),
        csvEscape(row.referral ?? ""),
        csvEscape(row.created_at ?? ""),
        csvEscape(hasAccount ? "true" : "false"),
      ].join(","),
    );
  }

  const csv = lines.join("\n") + "\n";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="signup-referrals.csv"`,
    },
  });
}
