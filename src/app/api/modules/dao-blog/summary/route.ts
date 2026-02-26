import { asUntypedAdmin, jsonError } from "@/app/api/modules/dao-blog/lib";
import { supabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const admin = asUntypedAdmin(supabaseAdminClient());
    const { data, error } = await admin
      .from("dao_blog_posts")
      .select("title,slug,published_at,status,deleted_at")
      .eq("status", "published")
      .is("deleted_at", null)
      .order("published_at", { ascending: false })
      .limit(3);

    if (error) {
      return jsonError(`Failed to load summary: ${error.message}`, 500);
    }

    return Response.json({
      title: "DAO Blog",
      items: ((data ?? []) as { title: string; slug: string; published_at: string | null }[]).map((row) => ({
        label: row.title,
        value: row.published_at ? new Date(row.published_at).toLocaleDateString("en-US") : "Draft",
        href: `/modules/dao-blog/${row.slug}`,
      })),
    });
  } catch (err) {
    console.error("[dao-blog] summary error:", err);
    return jsonError("Failed to load summary.", 500);
  }
}
