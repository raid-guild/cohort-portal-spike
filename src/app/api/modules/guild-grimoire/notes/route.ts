import { NextRequest } from "next/server";
import { requireAuth, asString, asStringArray, jsonError } from "@/app/api/modules/guild-grimoire/lib";

const MAX_TEXT = 256;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_AUDIO_BYTES = 3 * 1024 * 1024;

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const ALLOWED_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);

const ALLOWED_AUDIO_MIME_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/m4a",
  "audio/aac",
  "audio/mpeg",
]);
const ALLOWED_AUDIO_EXTENSIONS = new Set(["webm", "mp4", "m4a", "aac", "mp3"]);

function extensionFromFilename(filename: string) {
  const dotIdx = filename.lastIndexOf(".");
  // No extension (or dot-file like ".env")
  if (dotIdx < 1 || dotIdx === filename.length - 1) return null;
  return filename.slice(dotIdx + 1).toLowerCase() || null;
}

function normalizeMimeType(mimeType: string) {
  return mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
}

function extensionForImageMimeType(mimeType: string) {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}

function extensionForAudioMimeType(mimeType: string) {
  switch (mimeType) {
    case "audio/webm":
      return "webm";
    case "audio/mp4":
      return "mp4";
    case "audio/m4a":
      return "m4a";
    case "audio/aac":
      return "aac";
    case "audio/mpeg":
      return "mp3";
    default:
      return null;
  }
}

function sanitizeVisibility(raw: string | null) {
  if (!raw) return "shared";
  if (["private", "shared", "cohort", "public"].includes(raw)) return raw;
  return null;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return jsonError(auth.error, auth.status ?? 401);
  }

  const contentHeader = request.headers.get("content-type") ?? "";

  let contentType: string | null = null;
  let visibility: string | null = null;
  let textContent: string | null = null;
  let tagIds: string[] = [];
  let file: File | null = null;

  if (contentHeader.includes("multipart/form-data")) {
    const form = await request.formData();
    contentType = asString(form.get("content_type"));
    visibility = asString(form.get("visibility"));
    textContent = asString(form.get("text_content"));

    const rawFile = form.get("file");
    file = rawFile instanceof File ? rawFile : null;

    const tagFields = form.getAll("tag_ids");
    tagIds = tagFields.filter((v) => typeof v === "string") as string[];
  } else {
    const body = (await request.json().catch(() => null)) as
      | {
          content_type?: unknown;
          visibility?: unknown;
          text_content?: unknown;
          tag_ids?: unknown;
        }
      | null;

    contentType = asString(body?.content_type);
    visibility = asString(body?.visibility);
    textContent = asString(body?.text_content);
    tagIds = asStringArray(body?.tag_ids);
  }

  if (!contentType || !["text", "image", "audio"].includes(contentType)) {
    return jsonError("content_type must be one of: text, image, audio.", 400);
  }

  visibility = sanitizeVisibility(visibility);
  if (!visibility) {
    return jsonError("Invalid visibility.", 400);
  }

  let imageUrl: string | null = null;
  let audioUrl: string | null = null;
  let audioDurationSec: number | null = null;

  let uploadedImagePath: string | null = null;
  let uploadedAudioPath: string | null = null;

  if (contentType === "text") {
    const trimmed = (textContent ?? "").trim();
    if (!trimmed) {
      return jsonError("text_content is required for text notes.", 400);
    }
    if (trimmed.length > MAX_TEXT) {
      return jsonError(`text_content must be <= ${MAX_TEXT} characters.`, 400);
    }

    const insert = await auth.admin
      .from("guild_grimoire_notes")
      .insert({
        user_id: auth.userId,
        content_type: "text",
        text_content: trimmed,
        visibility,
      })
      .select("id")
      .single();

    if (insert.error) {
      console.error("[guild-grimoire] text insert error:", insert.error.message);
      return jsonError("Failed to create note.", 500);
    }

    const noteId = insert.data.id as string;

    if (tagIds.length) {
      const rows = tagIds.map((tagId) => ({ note_id: noteId, tag_id: tagId }));
      const linkRes = await auth.admin.from("guild_grimoire_note_tags").insert(rows);
      if (linkRes.error) {
        console.error("[guild-grimoire] link tags error:", linkRes.error.message);
        // non-fatal
      }
    }

    return Response.json({ id: noteId });
  }

  if (!file) {
    return jsonError("file is required for image/audio notes.", 400);
  }

  if (contentType === "image") {
    if (file.size > MAX_IMAGE_BYTES) {
      return jsonError("File too large. Max image size is 5MB.", 413);
    }

    let mimeType = normalizeMimeType(file.type);
    let extension = mimeType ? extensionForImageMimeType(mimeType) : null;

    if (!mimeType) {
      const ext = extensionFromFilename(file.name);
      if (!ext || !ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
        return jsonError(
          `Unsupported image type. Allowed extensions: ${Array.from(ALLOWED_IMAGE_EXTENSIONS).join(
            ", ",
          )}.`,
          400,
        );
      }
      extension = ext === "jpeg" ? "jpg" : ext;
      mimeType = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
    }

    if (!mimeType || !extension || !ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
      return jsonError(
        `Unsupported image type. Allowed: ${Array.from(ALLOWED_IMAGE_MIME_TYPES).join(
          ", ",
        )}.`,
        400,
      );
    }

    uploadedImagePath = `guild-grimoire/${auth.userId}/${crypto.randomUUID()}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await auth.admin.storage
      .from("modules")
      .upload(uploadedImagePath, buffer, { upsert: false, contentType: mimeType });

    if (uploadError) {
      console.error("[guild-grimoire] image upload error:", uploadError.message);
      return jsonError("Failed to upload image.", 500);
    }

    const { data: publicData } = auth.admin.storage.from("modules").getPublicUrl(uploadedImagePath);
    imageUrl = publicData.publicUrl;
  }

  if (contentType === "audio") {
    if (file.size > MAX_AUDIO_BYTES) {
      return jsonError("File too large. Max audio size is 3MB.", 413);
    }

    let mimeType = normalizeMimeType(file.type);
    let extension = mimeType ? extensionForAudioMimeType(mimeType) : null;

    if (!mimeType) {
      const ext = extensionFromFilename(file.name);
      if (!ext || !ALLOWED_AUDIO_EXTENSIONS.has(ext)) {
        return jsonError(
          `Unsupported audio type. Allowed extensions: ${Array.from(ALLOWED_AUDIO_EXTENSIONS).join(
            ", ",
          )}.`,
          400,
        );
      }
      extension = ext;
      const extToMime: Record<string, string> = {
        mp3: "audio/mpeg",
        webm: "audio/webm",
        mp4: "audio/mp4",
        m4a: "audio/m4a",
        aac: "audio/aac",
      };
      mimeType = extToMime[ext] ?? "audio/mp4";
    }

    if (!mimeType || !extension || !ALLOWED_AUDIO_MIME_TYPES.has(mimeType)) {
      return jsonError(
        `Unsupported audio type. Allowed: ${Array.from(ALLOWED_AUDIO_MIME_TYPES).join(
          ", ",
        )}.`,
        400,
      );
    }

    uploadedAudioPath = `guild-grimoire/${auth.userId}/${crypto.randomUUID()}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await auth.admin.storage
      .from("modules")
      .upload(uploadedAudioPath, buffer, { upsert: false, contentType: mimeType });

    if (uploadError) {
      console.error("[guild-grimoire] audio upload error:", uploadError.message);
      return jsonError("Failed to upload audio.", 500);
    }

    const { data: publicData } = auth.admin.storage.from("modules").getPublicUrl(uploadedAudioPath);
    audioUrl = publicData.publicUrl;
    audioDurationSec = null;
  }

  const insert = await auth.admin
    .from("guild_grimoire_notes")
    .insert({
      user_id: auth.userId,
      content_type: contentType,
      image_url: imageUrl,
      audio_url: audioUrl,
      audio_duration_sec: audioDurationSec,
      visibility,
    })
    .select("id")
    .single();

  if (insert.error) {
    console.error("[guild-grimoire] insert error:", insert.error.message);

    const toRemove = [uploadedImagePath, uploadedAudioPath].filter(
      (p): p is string => Boolean(p),
    );
    if (toRemove.length) {
      try {
        const { error: removeError } = await auth.admin.storage.from("modules").remove(toRemove);
        if (removeError) {
          console.error("[guild-grimoire] cleanup error:", removeError.message);
        }
      } catch {
        // noop
      }
    }

    return jsonError("Failed to create note.", 500);
  }

  const noteId = insert.data.id as string;

  if (tagIds.length) {
    const rows = tagIds.map((tagId) => ({ note_id: noteId, tag_id: tagId }));
    const linkRes = await auth.admin.from("guild_grimoire_note_tags").insert(rows);
    if (linkRes.error) {
      console.error("[guild-grimoire] link tags error:", linkRes.error.message);
    }
  }

  return Response.json({ id: noteId });
}
