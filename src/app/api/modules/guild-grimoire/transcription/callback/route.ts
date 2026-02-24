import { NextRequest } from "next/server";
import { asString, jsonError } from "@/app/api/modules/guild-grimoire/lib";
import { getTranscriptionCallbackKey } from "@/app/api/modules/guild-grimoire/transcription";
import { supabaseAdminClient } from "@/lib/supabase/admin";

type Body = {
  note_id?: unknown;
  status?: unknown;
  transcript?: unknown;
  error?: unknown;
};

function isAuthorized(request: NextRequest) {
  const key = getTranscriptionCallbackKey();
  if (!key) return false;
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${key}`) return true;
  return request.headers.get("x-grimoire-transcription-key") === key;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return jsonError("Unauthorized.", 401);
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const noteId = asString(body?.note_id);
  const status = asString(body?.status);
  const transcript = asString(body?.transcript);
  const errorMessage = asString(body?.error);
  if (!noteId) return jsonError("note_id is required.", 400);
  if (!status || !["pending", "completed", "failed"].includes(status)) {
    return jsonError("status must be one of: pending, completed, failed.", 400);
  }

  const admin = supabaseAdminClient();
  const updates: {
    audio_transcription_status: string;
    audio_transcript?: string | null;
  } = {
    audio_transcription_status: status,
  };

  if (status === "completed") {
    updates.audio_transcript = (transcript ?? "").trim() || null;
  } else if (status === "failed") {
    updates.audio_transcript = null;
    if (errorMessage) {
      console.error("[guild-grimoire] transcription callback failed:", noteId, errorMessage);
    }
  }

  const { data, error } = await admin
    .from("guild_grimoire_notes")
    .update(updates)
    .eq("id", noteId)
    .eq("content_type", "audio")
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[guild-grimoire] transcription callback update error:", error.message);
    return jsonError("Failed to update transcription.", 500);
  }
  if (!data?.id) {
    return jsonError("Audio note not found.", 404);
  }

  return Response.json({ ok: true, id: data.id });
}
