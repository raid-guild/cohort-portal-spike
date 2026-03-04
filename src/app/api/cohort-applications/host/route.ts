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

  const applications = data ?? [];
  const userIds = Array.from(new Set(applications.map((row) => row.user_id).filter(Boolean)));
  const profileByUserId = new Map<
    string,
    { user_id: string; handle: string; display_name: string | null; avatar_url: string | null }
  >();

  if (userIds.length) {
    const { data: profiles, error: profileError } = await result.admin
      .from("profiles")
      .select("user_id,handle,display_name,avatar_url")
      .in("user_id", userIds);

    if (profileError) {
      console.error("[cohort-applications] profile enrichment failed:", profileError);
    } else {
      for (const profile of profiles ?? []) {
        if (profile.user_id) {
          profileByUserId.set(profile.user_id, {
            user_id: profile.user_id,
            handle: profile.handle,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
          });
        }
      }
    }
  }

  return Response.json({
    applications: applications.map((item) => ({
      ...item,
      profile: profileByUserId.get(item.user_id) ?? null,
    })),
  });
}
