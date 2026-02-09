import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";

export type AuthResult =
  | { error: string; status?: number }
  | { userId: string; roles: string[]; admin: ReturnType<typeof supabaseAdminClient> };

export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Missing auth token.", status: 401 };
  }
  const token = authHeader.replace("Bearer ", "");
  const supabase = supabaseServerClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { error: "Invalid auth token.", status: 401 };
  }

  const admin = supabaseAdminClient();
  const { data: roleRows, error: rolesError } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);

  if (rolesError) {
    return { error: `Failed to load user roles: ${rolesError.message}`, status: 500 };
  }

  const roles = roleRows?.map((row) => row.role) ?? [];
  return { userId: data.user.id, roles, admin };
}

export async function requireHost(request: NextRequest): Promise<AuthResult> {
  const result = await requireAuth(request);
  if ("error" in result) return result;
  if (!result.roles.includes("host")) {
    return { error: "Host access required.", status: 403 };
  }
  return result;
}
