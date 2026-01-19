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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await requireHost(request);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 403 });
  }

  const { id } = await context.params;
  let notes: string | null = null;
  try {
    const body = (await request.json()) as { notes?: string };
    notes = body.notes?.trim() ?? null;
  } catch {
    notes = null;
  }

  const { data: application, error } = await result.admin
    .from("cohort_applications")
    .update({ status: "approved", signal_check_status: "complete" })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !application) {
    return Response.json(
      { error: error?.message ?? "Application not found." },
      { status: 404 },
    );
  }

  await result.admin.from("entitlements").upsert(
    {
      user_id: application.user_id,
      entitlement: "cohort-approved",
      status: "active",
      metadata: { source: "approval", notes },
    },
    { onConflict: "user_id,entitlement" },
  );

  return Response.json({ application });
}
