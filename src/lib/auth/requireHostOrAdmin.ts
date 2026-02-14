import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";

type GateFailure = { ok: false; status: 401 | 403 | 500; error: string };
type GateSuccess = { ok: true; admin: ReturnType<typeof supabaseAdminClient>; userId: string };

export async function requireHostOrAdmin(request: NextRequest): Promise<GateFailure | GateSuccess> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Missing auth token." };
  }

  const token = authHeader.slice("Bearer ".length);
  const supabase = supabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    return { ok: false, status: 401, error: "Invalid auth token." };
  }

  const admin = supabaseAdminClient();
  const { data: roleRows, error: roleError } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);

  if (roleError) {
    return { ok: false, status: 500, error: roleError.message };
  }

  const roles = roleRows?.map((row) => row.role) ?? [];
  const allowed = roles.includes("host") || roles.includes("admin");
  if (!allowed) {
    return { ok: false, status: 403, error: "Host role required." };
  }

  return { ok: true, admin, userId: userData.user.id };
}
