import { NextRequest } from "next/server";
import {
  asUntypedAdmin,
  canReadSpace,
  getViewer,
  jsonError,
  loadForumAuthorsByUserId,
  sanitizeCommentForResponse,
  sanitizePostForResponse,
  type ForumComment,
  type ForumPost,
  type ForumSpace,
} from "@/app/api/modules/member-forum/lib";

async function loadPostContext(request: NextRequest, id: string) {
  const viewer = await getViewer(request);
  const admin = asUntypedAdmin(viewer.admin);

  const postRes = await admin
    .from("forum_posts")
    .select("id,space_id,author_id,title,body_md,is_locked,is_deleted,created_at,updated_at")
    .eq("id", id)
    .maybeSingle();

  if (postRes.error) {
    return { viewer, error: jsonError(postRes.error.message, 500) };
  }
  if (!postRes.data) {
    return { viewer, error: jsonError("Post not found.", 404) };
  }

  const post = postRes.data as ForumPost;
  if (post.is_deleted) {
    return { viewer, error: jsonError("Post not found.", 404) };
  }

  const spaceRes = await admin
    .from("forum_spaces")
    .select("id,slug,name,description,read_level,write_level,cohort_id")
    .eq("id", post.space_id)
    .maybeSingle();

  if (spaceRes.error) {
    return { viewer, error: jsonError(spaceRes.error.message, 500) };
  }
  if (!spaceRes.data) {
    return { viewer, error: jsonError("Space not found.", 404) };
  }

  const space = spaceRes.data as ForumSpace;
  if (!canReadSpace(space, viewer)) {
    return { viewer, error: jsonError("Access denied.", 403) };
  }

  return { viewer, post, space };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolved = await params;
    const loaded = await loadPostContext(request, resolved.id);
    if ("error" in loaded) {
      return loaded.error;
    }

    const admin = asUntypedAdmin(loaded.viewer.admin);
    const commentsRes = await admin
      .from("forum_comments")
      .select("id,post_id,author_id,parent_comment_id,body_md,is_deleted,created_at,updated_at")
      .eq("post_id", resolved.id)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true });

    if (commentsRes.error) {
      return jsonError(commentsRes.error.message, 500);
    }

    const comments = ((commentsRes.data ?? []) as ForumComment[]).map(sanitizeCommentForResponse);
    const authorByUserId = await loadForumAuthorsByUserId(admin, [
      loaded.post.author_id,
      ...comments.map((comment) => comment.author_id),
    ]);

    return Response.json({
      post: {
        ...sanitizePostForResponse(loaded.post),
        space: loaded.space,
        author: authorByUserId.get(loaded.post.author_id) ?? null,
      },
      comments: comments.map((comment) => ({
        ...comment,
        author: authorByUserId.get(comment.author_id) ?? null,
      })),
    });
  } catch (err) {
    console.error("[member-forum] post detail error:", err);
    return jsonError("Failed to load post.", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolved = await params;
    const loaded = await loadPostContext(request, resolved.id);
    if ("error" in loaded) {
      return loaded.error;
    }

    if (!loaded.viewer.userId) {
      return jsonError("Authentication required.", 401);
    }

    const isOwner = loaded.post.author_id === loaded.viewer.userId;
    const isHost = loaded.viewer.roles.includes("host") || loaded.viewer.roles.includes("admin");
    if (!isOwner && !isHost) {
      return jsonError("Delete access denied.", 403);
    }

    const admin = asUntypedAdmin(loaded.viewer.admin);
    const { error } = await admin
      .from("forum_posts")
      .update({ is_deleted: true })
      .eq("id", resolved.id);

    if (error) {
      return jsonError(error.message, 500);
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[member-forum] delete post error:", err);
    return jsonError("Failed to delete post.", 500);
  }
}
