import { NextRequest } from "next/server";
import {
  asUntypedAdmin,
  canAuthor,
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

    const resolved = await params;
    const post = await loadPostById(viewer.admin, resolved.id);
    if (!post || post.deleted_at) {
      return jsonError("Post not found.", 404);
    }

    if (post.author_user_id !== viewer.userId) {
      return jsonError("Only the author can submit for review.", 403);
    }

    if (!isHostRole(viewer.roles) && !canAuthor(viewer)) {
      return jsonError("Active dao-member entitlement required.", 403);
    }

    if (post.status !== "draft") {
      return jsonError("Only draft posts can be submitted for review.", 400);
    }

    const admin = asUntypedAdmin(viewer.admin);
    const { data, error } = await admin
      .from("dao_blog_posts")
      .update({
        status: "in_review",
        review_submitted_at: new Date().toISOString(),
        review_notes: null,
      })
      .eq("id", resolved.id)
      .select(
        "id,title,slug,summary,header_image_url,body_md,status,published_at,author_user_id,review_submitted_at,reviewed_at,reviewed_by,review_notes,created_at,updated_at,deleted_at",
      )
      .single();

    if (error || !data) {
      return jsonError(error?.message || "Failed to submit review.", 500);
    }

    return Response.json({ post: data });
  } catch (err) {
    console.error("[dao-blog] submit-review error:", err);
    return jsonError("Failed to submit review.", 500);
  }
}
