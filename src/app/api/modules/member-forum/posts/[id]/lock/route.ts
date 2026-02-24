import { NextRequest } from "next/server";
import { asUntypedAdmin, getViewer, isHost, jsonError } from "@/app/api/modules/member-forum/lib";

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
    if (!isHost(viewer)) {
      return jsonError("Host access required.", 403);
    }

    const admin = asUntypedAdmin(viewer.admin);
    const postRes = await admin
      .from("forum_posts")
      .select("id,is_locked,is_deleted")
      .eq("id", resolved.id)
      .maybeSingle();
    const post = postRes.data as { id: string; is_locked: boolean; is_deleted: boolean } | null;

    if (postRes.error) {
      return jsonError(postRes.error.message, 500);
    }
    if (!post || post.is_deleted) {
      return jsonError("Post not found.", 404);
    }

    const payload = (await request.json().catch(() => null)) as { is_locked?: unknown } | null;
    const requested = payload?.is_locked;
    const nextLocked = typeof requested === "boolean" ? requested : !post.is_locked;

    const updateRes = await admin
      .from("forum_posts")
      .update({ is_locked: nextLocked })
      .eq("id", resolved.id)
      .select("id,is_locked")
      .single();

    if (updateRes.error || !updateRes.data) {
      return jsonError(updateRes.error?.message || "Failed to update lock state.", 500);
    }

    return Response.json({ post: updateRes.data });
  } catch (err) {
    console.error("[member-forum] lock toggle error:", err);
    return jsonError("Failed to update lock state.", 500);
  }
}
