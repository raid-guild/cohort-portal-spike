import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";

const requireHost = async (request: NextRequest) => {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Missing auth token." } as const;
  }
  const token = authHeader.replace("Bearer ", "");
  const supabase = supabaseServerClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { error: "Invalid auth token." } as const;
  }

  const admin = supabaseAdminClient();
  const { data: roleRow, error: roleError } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("role", "host")
    .maybeSingle();

  if (roleError || !roleRow) {
    return { error: "Host access required." } as const;
  }

  return { admin } as const;
};

export async function GET(request: NextRequest) {
  const result = await requireHost(request);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 403 });
  }

  const { data, error } = await result.admin
    .from("cohort_applications")
    .select("*")
    .order("applied_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ applications: data ?? [] });
}
