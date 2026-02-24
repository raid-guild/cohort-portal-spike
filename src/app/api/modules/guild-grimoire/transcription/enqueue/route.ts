import { NextRequest } from "next/server";
import { asString, jsonError, requireAuth } from "@/app/api/modules/guild-grimoire/lib";
import { enqueueTranscriptionJob } from "@/app/api/modules/guild-grimoire/transcription";

type Body = {
  note_id?: unknown;
};

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) return jsonError(auth.error, auth.status ?? 401);

  const body = (await request.json().catch(() => null)) as Body | null;
  const noteId = asString(body?.note_id);
  if (!noteId) return jsonError("note_id is required.", 400);

  const existing = await auth.admin
    .from("guild_grimoire_notes")
    .select("id,user_id,content_type,audio_url")
    .eq("id", noteId)
    .single();
  if (existing.error || !existing.data) {
    return jsonError("Note not found.", 404);
  }
  if (existing.data.user_id !== auth.userId) {
    return jsonError("Forbidden.", 403);
  }
  if (existing.data.content_type !== "audio" || !existing.data.audio_url) {
    return jsonError("Only audio notes can be enqueued.", 400);
  }

  let parsed: URL;
  try {
    parsed = new URL(existing.data.audio_url);
  } catch {
    return jsonError("Unsupported audio URL format.", 400);
  }
  const marker = "/storage/v1/object/public/modules/";
  const markerIndex = parsed.pathname.indexOf(marker);
  if (markerIndex < 0) {
    return jsonError("Unsupported audio URL format.", 400);
  }
  let audioPath: string;
  try {
    audioPath = decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
  } catch {
    return jsonError("Unsupported audio URL format.", 400);
  }
  const callbackUrl = `${new URL(request.url).origin}/api/modules/guild-grimoire/transcription/callback`;

  const enqueue = await enqueueTranscriptionJob({
    noteId,
    userId: auth.userId,
    audioUrl: existing.data.audio_url,
    audioPath,
    callbackUrl,
  });
  if (!enqueue.ok) {
    return jsonError(`Failed to enqueue transcription: ${enqueue.reason}`, 502);
  }

  const { error: updateError } = await auth.admin
    .from("guild_grimoire_notes")
    .update({ audio_transcription_status: "pending" })
    .eq("id", noteId);
  if (updateError) {
    return jsonError("Failed to mark note pending.", 500);
  }

  return Response.json({ ok: true });
}
