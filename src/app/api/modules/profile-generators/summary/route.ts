import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ title: "Profile generators", items: [] }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = supabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return Response.json({ title: "Profile generators", items: [] }, { status: 401 });
  }

  const admin = supabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (error) {
    return Response.json({ title: "Profile generators", items: [] });
  }

  return Response.json({
    title: "Profile generators",
    items: [
      { label: "Avatar", value: data?.avatar_url ?? "" },
      { label: "Display name", value: data?.display_name ?? "Missing" },
    ],
  });
}
