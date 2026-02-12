import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { getViewerIdFromAuthHeader } from "@/app/api/modules/raider-timeline/lib";

export async function GET(request: NextRequest) {
  const viewerId = await getViewerIdFromAuthHeader(request);
  if (!viewerId) {
    return Response.json({ error: "Missing auth token." }, { status: 401 });
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
  const includeImage = Boolean(top?.image_url);

  const items: { label: string; value: string }[] = [];
  if (includeImage && top?.image_url) {
    items.push({ label: "Image", value: top.image_url });
  }

  const postLimit = includeImage ? 2 : 3;
  for (const post of (data ?? []).slice(0, postLimit)) {
    items.push({ label: post.title, value: post.impact_statement });
  }

  return Response.json({ title: "Latest Wins", items });
}
