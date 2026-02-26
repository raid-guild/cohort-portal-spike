import { NextRequest } from "next/server";
import { asUntypedAdmin, canAuthor, isHostRole, jsonError, requireViewer } from "@/app/api/modules/dao-blog/lib";

export async function GET(request: NextRequest) {
  try {
    const viewer = await requireViewer(request);
    if ("error" in viewer) {
      return jsonError(viewer.error, viewer.status);
    }

    if (!canAuthor(viewer) && !isHostRole(viewer.roles)) {
      return jsonError("Access denied.", 403);
    }

    const admin = asUntypedAdmin(viewer.admin);
    const query = admin
      .from("dao_blog_posts")
      .select(
        "id,title,slug,summary,header_image_url,body_md,status,published_at,author_user_id,review_submitted_at,reviewed_at,reviewed_by,review_notes,created_at,updated_at,deleted_at",
      )
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (!isHostRole(viewer.roles)) {
      query.eq("author_user_id", viewer.userId);
    }

    const { data, error } = await query;
    if (error) {
      return jsonError(`Failed to load manage list: ${error.message}`, 500);
    }

    return Response.json({ posts: data ?? [] });
  } catch (err) {
    console.error("[dao-blog] manage list error:", err);
    return jsonError("Failed to load posts.", 500);
  }
}
