import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
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
    .from("showcase_posts")
    .select("title,impact_statement,image_url,boost_count,created_at")
    .order("created_at", { ascending: false })
    .limit(3);

  if (error) {
    console.error("[raid-showcase/summary] query error:", error.message);
    return Response.json({ title: "Latest Wins", items: [] });
  }

  const top = data?.[0];

  const items: { label: string; value: string }[] = [];
  if (top?.image_url) {
    items.push({ label: "Image", value: top.image_url });
  }

  for (const post of data ?? []) {
    items.push({ label: post.title, value: post.impact_statement });
  }

  return Response.json({ title: "Latest Wins", items });
}
