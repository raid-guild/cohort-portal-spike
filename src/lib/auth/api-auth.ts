import type { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";

export type AuthResult =
  | { error: string; status?: number }
  | { userId: string; roles: string[]; admin: ReturnType<typeof supabaseAdminClient> };

function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length);
}

export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  const token = extractBearerToken(request);
  if (!token) return { error: "Missing auth token.", status: 401 };

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

  // allow either explicit host role or admin role
  if (!result.roles.includes("host") && !result.roles.includes("admin")) {
    return { error: "Host access required.", status: 403 };
  }

  return result;
}
