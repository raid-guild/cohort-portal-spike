import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const jsonError = (error: string, status = 400) => Response.json({ error }, { status });

const requireUser = async (request: NextRequest) => {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Missing auth token.", status: 401 } as const;
  }
  const token = authHeader.replace("Bearer ", "");
  const supabase = supabaseServerClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { error: "Invalid auth token.", status: 401 } as const;
  }
  return { user: data.user } as const;
};

const isHost = async (userId: string) => {
  const admin = supabaseAdminClient();
  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "host")
    .maybeSingle();
  return Boolean(data);
};

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

function hasValidImageSignature(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

export async function POST(request: NextRequest) {
  try {
    const userResult = await requireUser(request);
    if ("error" in userResult) {
      return jsonError(userResult.error ?? "Unauthorized.", userResult.status ?? 401);
    }

    if (!(await isHost(userResult.user.id))) {
      return jsonError("Host access required.", 403);
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return jsonError("file is required.");
    }

    if (file.size > MAX_IMAGE_BYTES) {
      return jsonError("Partner logo must be 5MB or smaller.", 413);
    }

    let mimeType = normalizeMimeType(file.type);
    let extension = mimeType ? extensionFromMimeType(mimeType) : null;

    if (!mimeType) {
      const ext = extensionFromFilename(file.name || null);
      if (!ext || !ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
        return jsonError("Partner logo must be JPEG, PNG, or WebP.");
      }
      extension = ext === "jpeg" ? "jpg" : ext;
      mimeType =
        extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!hasValidImageSignature(bytes, mimeType)) {
      return jsonError("Partner logo must be JPEG, PNG, or WebP.");
    }

    const path = `cohort-hub/partners/${userResult.user.id}/${crypto.randomUUID()}.${extension}`;
    const admin = supabaseAdminClient();
    const { error: uploadError } = await admin.storage
      .from("modules")
      .upload(path, Buffer.from(bytes), {
        upsert: false,
        contentType: mimeType,
      });

    if (uploadError) {
      console.error("[cohort-hub] partner logo upload error:", uploadError.message);
      return jsonError("Failed to upload partner logo.", 500);
    }

    const { data: publicData } = admin.storage.from("modules").getPublicUrl(path);
    return Response.json({
      url: publicData.publicUrl,
      path,
      mime_type: mimeType,
      size_bytes: file.size,
    });
  } catch (err) {
    console.error("[cohort-hub] partner logo route error:", err);
    return jsonError("Failed to upload partner logo.", 500);
  }
}
