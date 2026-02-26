import { NextRequest } from "next/server";
import {
  asString,
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

    const body = (await request.json().catch(() => null)) as { review_notes?: unknown } | null;
    const reviewNotes = asString(body?.review_notes);

    const admin = asUntypedAdmin(viewer.admin);
    const { data, error } = await admin
      .from("dao_blog_posts")
      .update({
        status: "draft",
        published_at: null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: viewer.userId,
        review_notes: reviewNotes,
      })
      .eq("id", resolved.id)
      .select(
        "id,title,slug,summary,header_image_url,body_md,status,published_at,author_user_id,review_submitted_at,reviewed_at,reviewed_by,review_notes,created_at,updated_at,deleted_at",
      )
      .single();

    if (error || !data) {
      return jsonError(error?.message || "Failed to reject post.", 500);
    }

    return Response.json({ post: data });
  } catch (err) {
    console.error("[dao-blog] reject error:", err);
    return jsonError("Failed to reject post.", 500);
  }
}
