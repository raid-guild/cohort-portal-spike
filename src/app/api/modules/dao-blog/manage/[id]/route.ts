import { NextRequest } from "next/server";
import {
  canAuthor,
  isHostRole,
  jsonError,
  loadPostById,
  requireViewer,
} from "@/app/api/modules/dao-blog/lib";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const viewer = await requireViewer(request);
    if ("error" in viewer) {
      return jsonError(viewer.error, viewer.status);
    }

    if (!canAuthor(viewer) && !isHostRole(viewer.roles)) {
      return jsonError("Access denied.", 403);
    }

    const resolved = await params;
    const post = await loadPostById(viewer.admin, resolved.id);
    if (!post || post.deleted_at) {
      return jsonError("Post not found.", 404);
    }

    if (!isHostRole(viewer.roles) && post.author_user_id !== viewer.userId) {
      return jsonError("Access denied.", 403);
    }

    return Response.json({ post });
  } catch (err) {
    console.error("[dao-blog] manage detail error:", err);
    return jsonError("Failed to load post.", 500);
  }
}
