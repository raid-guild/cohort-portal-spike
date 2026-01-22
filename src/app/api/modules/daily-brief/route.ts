import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Missing auth token." }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = supabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return Response.json({ error: "Invalid auth token." }, { status: 401 });
  }

  const admin = supabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("handle, display_name")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (error || !data) {
    return Response.json({ error: "Profile not found." }, { status: 404 });
  }

  return Response.json({
    handle: data.handle,
    displayName: data.display_name ?? null,
  });
}
