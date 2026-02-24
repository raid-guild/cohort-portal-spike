const TRANSCRIPTION_WEBHOOK_URL = process.env.GUILD_GRIMOIRE_TRANSCRIPTION_WEBHOOK_URL ?? "";
const TRANSCRIPTION_WEBHOOK_KEY = process.env.GUILD_GRIMOIRE_TRANSCRIPTION_WEBHOOK_KEY ?? "";
const TRANSCRIPTION_CALLBACK_KEY = process.env.GUILD_GRIMOIRE_TRANSCRIPTION_CALLBACK_KEY ?? "";
const TRANSCRIPTION_WEBHOOK_TIMEOUT_MS = 10_000;

type EnqueueInput = {
  noteId: string;
  userId: string;
  audioUrl: string;
  audioPath: string;
  callbackUrl: string;
};

export function getTranscriptionCallbackKey() {
  return TRANSCRIPTION_CALLBACK_KEY;
}

export function canEnqueueTranscription() {
  return Boolean(TRANSCRIPTION_WEBHOOK_URL && TRANSCRIPTION_CALLBACK_KEY);
}

export async function enqueueTranscriptionJob(input: EnqueueInput) {
  if (!canEnqueueTranscription()) {
    return {
      ok: false as const,
      reason:
        "Missing GUILD_GRIMOIRE_TRANSCRIPTION_WEBHOOK_URL or GUILD_GRIMOIRE_TRANSCRIPTION_CALLBACK_KEY.",
    };
  }

  try {
    const signal = AbortSignal.timeout(TRANSCRIPTION_WEBHOOK_TIMEOUT_MS);
    const response = await fetch(TRANSCRIPTION_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(TRANSCRIPTION_WEBHOOK_KEY
          ? { Authorization: `Bearer ${TRANSCRIPTION_WEBHOOK_KEY}` }
          : {}),
      },
      body: JSON.stringify({
        note_id: input.noteId,
        user_id: input.userId,
        audio_url: input.audioUrl,
        audio_path: input.audioPath,
        callback_url: input.callbackUrl,
        callback_token: TRANSCRIPTION_CALLBACK_KEY,
      }),
      signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        ok: false as const,
        reason: `Webhook returned ${response.status}${body ? `: ${body.slice(0, 300)}` : ""}`,
      };
    }

    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      reason: error instanceof Error ? error.message : "Webhook request failed.",
    };
  }
}
