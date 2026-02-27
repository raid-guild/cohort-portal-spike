import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";

export type FeedbackAuthResult =
  | { error: string; status: number }
  | {
      userId: string;
      roles: string[];
      isHost: boolean;
      admin: ReturnType<typeof supabaseAdminClient>;
    };

export async function requireFeedbackAuth(
  request: NextRequest,
): Promise<FeedbackAuthResult> {
  try {
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
    const isHost = roles.includes("host") || roles.includes("admin");

    return { userId: data.user.id, roles, isHost, admin };
  } catch {
    return { error: "Feedback auth is not configured on the server.", status: 500 };
  }
}
