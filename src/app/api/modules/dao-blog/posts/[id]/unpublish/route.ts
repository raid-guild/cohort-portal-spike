import { NextRequest } from "next/server";
import {
  asUntypedAdmin,
  isHostRole,
  jsonError,
  loadPostById,
  requireViewer,
} from "@/app/api/modules/dao-blog/lib";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const viewer = await requireViewer(request);
    if ("error" in viewer) {
      return jsonError(viewer.error, viewer.status);
    }

    if (!isHostRole(viewer.roles)) {
      return jsonError("Host role required.", 403);
    }

    const resolved = await params;
    const post = await loadPostById(viewer.admin, resolved.id);
    if (!post || post.deleted_at) {
      return jsonError("Post not found.", 404);
    }
    if (post.status !== "published") {
      return jsonError("Only published posts can be unpublished.", 409);
    }

    const admin = asUntypedAdmin(viewer.admin);
    const { data, error } = await admin
      .from("dao_blog_posts")
      .update({
        status: "draft",
        published_at: null,
      })
      .eq("id", resolved.id)
      .is("deleted_at", null)
      .eq("status", "published")
      .select(
        "id,title,slug,summary,header_image_url,body_md,status,published_at,author_user_id,review_submitted_at,reviewed_at,reviewed_by,review_notes,created_at,updated_at,deleted_at",
      )
      .maybeSingle();

    if (error) {
      return jsonError(error.message || "Failed to unpublish post.", 500);
    }
    if (!data) {
      return jsonError("Post is no longer published.", 409);
    }

    return Response.json({ post: data });
  } catch (err) {
    console.error("[dao-blog] unpublish error:", err);
    return jsonError("Failed to unpublish post.", 500);
  }
}
