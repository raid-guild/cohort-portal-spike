import { NextRequest } from "next/server";
import { asUntypedAdmin, getViewer, isHost, jsonError } from "@/app/api/modules/member-forum/lib";

export async function DELETE(
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
    const commentRes = await admin
      .from("forum_comments")
      .select("id,author_id,is_deleted")
      .eq("id", resolved.id)
      .maybeSingle();
    const comment = commentRes.data as { id: string; author_id: string; is_deleted: boolean } | null;

    if (commentRes.error) {
      return jsonError(commentRes.error.message, 500);
    }
    if (!comment || comment.is_deleted) {
      return jsonError("Comment not found.", 404);
    }

    const isOwner = comment.author_id === viewer.userId;
    if (!isOwner && !isHost(viewer)) {
      return jsonError("Delete access denied.", 403);
    }

    const { error } = await admin
      .from("forum_comments")
      .update({ is_deleted: true })
      .eq("id", resolved.id);

    if (error) {
      return jsonError(error.message, 500);
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[member-forum] delete comment error:", err);
    return jsonError("Failed to delete comment.", 500);
  }
}
