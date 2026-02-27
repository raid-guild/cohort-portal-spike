import { NextRequest } from "next/server";
import {
  asUntypedAdmin,
  isHostRole,
  jsonError,
  loadPostById,
  requireViewer,
} from "@/app/api/modules/dao-blog/lib";
import { emitPortalEvent } from "@/lib/portal-events";

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

    if (post.status !== "in_review") {
      return jsonError("Only in_review posts can be approved.", 400);
    }

    if (!post.summary || !post.header_image_url) {
      return jsonError("summary and header_image_url are required before publish.", 400);
    }

    const admin = asUntypedAdmin(viewer.admin);
    const now = new Date().toISOString();
    const { data, error } = await admin
      .from("dao_blog_posts")
      .update({
        status: "published",
        published_at: now,
        reviewed_at: now,
        reviewed_by: viewer.userId,
      })
      .eq("id", resolved.id)
      .select(
        "id,title,slug,summary,header_image_url,body_md,status,published_at,author_user_id,review_submitted_at,reviewed_at,reviewed_by,review_notes,created_at,updated_at,deleted_at",
      )
      .single();

    if (error || !data) {
      return jsonError(error?.message || "Failed to approve post.", 500);
    }
    const updatedPost = data as {
      id: string;
      slug: string;
      title: string;
      published_at: string | null;
    };

    try {
      await emitPortalEvent({
        moduleId: "dao-blog",
        kind: "core.dao_blog.post_published",
        authenticatedUserId: viewer.userId,
        actorId: viewer.userId,
        subject: { type: "dao_blog_post", id: updatedPost.id },
        visibility: "public",
        data: {
          slug: updatedPost.slug,
          title: updatedPost.title,
          publishedAt: updatedPost.published_at,
        },
        dedupeKey: `dao_blog_post:${updatedPost.id}:published`,
      });
    } catch (emitError) {
      console.error("[dao-blog] emit post_published failed:", emitError);
    }

    return Response.json({ post: data });
  } catch (err) {
    console.error("[dao-blog] approve error:", err);
    return jsonError("Failed to approve post.", 500);
  }
}
