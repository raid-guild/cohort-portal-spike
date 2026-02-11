import { supabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = supabaseAdminClient();
  const { data, error } = await admin
    .from("showcase_posts")
    .select("title,impact_statement,image_url,boost_count,created_at")
    .order("created_at", { ascending: false })
    .limit(3);

  if (error) {
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
