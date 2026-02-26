import { NextRequest } from "next/server";
import { asString, canAuthor, jsonError, requireViewer } from "@/app/api/modules/dao-blog/lib";

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function normalizeMimeType(input: string | null) {
  if (!input) return null;
  const normalized = input.toLowerCase();
  return ALLOWED_IMAGE_MIME_TYPES.has(normalized) ? normalized : null;
}

function extensionFromMimeType(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function extensionFromFilename(filename: string | null) {
  if (!filename) return null;
  const idx = filename.lastIndexOf(".");
  if (idx < 0 || idx === filename.length - 1) return null;
  return filename.slice(idx + 1).toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const viewer = await requireViewer(request);
    if ("error" in viewer) {
      return jsonError(viewer.error, viewer.status);
    }

    if (!canAuthor(viewer)) {
      return jsonError("Active dao-member entitlement required.", 403);
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return jsonError("file is required.");
    }

    if (file.size > MAX_IMAGE_BYTES) {
      return jsonError("Header image must be 5MB or smaller.", 413);
    }

    let mimeType = normalizeMimeType(file.type);
    let extension = mimeType ? extensionFromMimeType(mimeType) : null;

    if (!mimeType) {
      const ext = extensionFromFilename(asString(file.name));
      if (!ext || !ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
        return jsonError("Header image must be JPEG, PNG, or WebP.", 400);
      }
      extension = ext === "jpeg" ? "jpg" : ext;
      mimeType =
        extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
    }

    const path = `dao-blog/${viewer.userId}/${crypto.randomUUID()}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await viewer.admin.storage.from("modules").upload(path, buffer, {
      upsert: false,
      contentType: mimeType,
    });
    if (uploadError) {
      console.error("[dao-blog] header image upload error:", uploadError.message);
      return jsonError("Failed to upload header image.", 500);
    }

    const { data: publicData } = viewer.admin.storage.from("modules").getPublicUrl(path);
    return Response.json({
      url: publicData.publicUrl,
      path,
      mime_type: mimeType,
      size_bytes: file.size,
    });
  } catch (err) {
    console.error("[dao-blog] header image route error:", err);
    return jsonError("Failed to upload header image.", 500);
  }
}
