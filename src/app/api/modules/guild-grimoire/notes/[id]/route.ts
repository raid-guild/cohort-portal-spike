import { NextRequest } from "next/server";
import { requireAuth, jsonError } from "@/app/api/modules/guild-grimoire/lib";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return jsonError(auth.error, auth.status ?? 401);
  }

  const { id } = await context.params;
  if (!id) {
    return jsonError("Missing note id.", 400);
  }

  const existing = await auth.admin
    .from("guild_grimoire_notes")
    .select("id,user_id,deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (existing.error) {
    console.error("[guild-grimoire] note lookup error:", existing.error.message);
    return jsonError("Failed to delete note.", 500);
  }

  if (!existing.data) {
    return jsonError("Note not found.", 404);
  }

  if (existing.data.user_id !== auth.userId) {
    return jsonError("Only the owner can delete this note.", 403);
  }

  if (existing.data.deleted_at) {
    return Response.json({ ok: true });
  }

  const { error: updateError } = await auth.admin
    .from("guild_grimoire_notes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (updateError) {
    console.error("[guild-grimoire] soft delete error:", updateError.message);
    return jsonError("Failed to delete note.", 500);
  }

  return Response.json({ ok: true });
}
