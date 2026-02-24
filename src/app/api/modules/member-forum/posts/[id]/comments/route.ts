import { NextRequest } from "next/server";
import {
  asUntypedAdmin,
  canWriteSpace,
  getViewer,
  jsonError,
  sanitizeCommentForResponse,
  type ForumComment,
  type ForumPost,
  type ForumSpace,
} from "@/app/api/modules/member-forum/lib";

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolved = await params;
    const viewer = await getViewer(request);
    if (!viewer.userId) {
      return jsonError("Authentication required.", 401);
    }

    const admin = asUntypedAdmin(viewer.admin);
    const postRes = await admin
      .from("forum_posts")
      .select("id,space_id,is_locked,is_deleted")
      .eq("id", resolved.id)
      .maybeSingle();

    if (postRes.error || !postRes.data) {
      return jsonError("Post not found.", 404);
    }

    const post = postRes.data as Pick<ForumPost, "id" | "space_id" | "is_locked" | "is_deleted">;
    if (post.is_deleted) {
      return jsonError("Post not found.", 404);
    }
    if (post.is_locked) {
      return jsonError("Post is locked.", 409);
    }

    const spaceRes = await admin
      .from("forum_spaces")
      .select("id,slug,name,description,read_level,write_level,cohort_id")
      .eq("id", post.space_id)
      .maybeSingle();

    if (spaceRes.error || !spaceRes.data) {
      return jsonError("Space not found.", 404);
    }

    const space = spaceRes.data as ForumSpace;
    if (!canWriteSpace(space, viewer)) {
      return jsonError("Write access denied.", 403);
    }

    const body = (await request.json().catch(() => null)) as
      | { body_md?: unknown; parent_comment_id?: unknown }
      | null;

    const bodyMd = asString(body?.body_md);
    const parentCommentId = asString(body?.parent_comment_id) || null;

    if (!bodyMd) {
      return jsonError("body_md is required.");
    }

    if (parentCommentId) {
      const parentRes = await admin
        .from("forum_comments")
        .select("id,post_id,is_deleted")
        .eq("id", parentCommentId)
        .maybeSingle();
      const parent = parentRes.data as { id: string; post_id: string; is_deleted: boolean } | null;

      if (parentRes.error || !parent || parent.post_id !== resolved.id) {
        return jsonError("Invalid parent_comment_id.");
      }
      if (parent.is_deleted) {
        return jsonError("Parent comment not available.", 409);
      }
    }

    const insertRes = await admin
      .from("forum_comments")
      .insert({
        post_id: resolved.id,
        author_id: viewer.userId,
        parent_comment_id: parentCommentId,
        body_md: bodyMd,
      })
      .select("id,post_id,author_id,parent_comment_id,body_md,is_deleted,created_at,updated_at")
      .single();

    if (insertRes.error || !insertRes.data) {
      return jsonError(insertRes.error?.message || "Failed to create comment.", 500);
    }

    return Response.json({ comment: sanitizeCommentForResponse(insertRes.data as ForumComment) });
  } catch (err) {
    console.error("[member-forum] create comment error:", err);
    return jsonError("Failed to create comment.", 500);
  }
}
