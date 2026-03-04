import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { getViewerIdFromAuthHeader } from "@/app/api/modules/raider-timeline/lib";

const MAX_TITLE = 100;
const MAX_IMPACT = 280;

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const ALLOWED_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif"]);

type ShowcasePostRow = {
  id: string;
  user_id: string;
  image_url: string;
  title: string;
  impact_statement: string;
  boost_count: number;
  created_at: string;
};

type ShowcaseAuthor = {
  user_id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
};

function extensionFromFilename(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  return ext;
}

function sanitizeHttpsUrl(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > 2048) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return null;
    if (!url.hostname) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function extensionForImageMimeType(mimeType: string) {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return null;
  }
}

function mimeTypeForImageExtension(extension: string) {
  switch (extension) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return null;
  }
}

async function withShowcaseAuthors(
  admin: ReturnType<typeof supabaseAdminClient>,
  rows: ShowcasePostRow[],
) {
  const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)));
  const authorByUserId = new Map<string, ShowcaseAuthor>();

  if (userIds.length) {
    const { data: profiles, error: profileError } = await admin
      .from("profiles")
      .select("user_id,handle,display_name,avatar_url")
      .in("user_id", userIds);

    if (profileError) {
      throw new Error(profileError.message);
    }

    for (const profile of (profiles ?? []) as ShowcaseAuthor[]) {
      if (profile.user_id) {
        authorByUserId.set(profile.user_id, profile);
      }
    }
  }

  return rows.map((row) => ({
    ...row,
    author: authorByUserId.get(row.user_id) ?? null,
  }));
}

export async function GET(request: NextRequest) {
  const viewerId = await getViewerIdFromAuthHeader(request);
  if (!viewerId) {
    return Response.json({ error: "Missing auth token." }, { status: 401 });
  }

  const admin = supabaseAdminClient();
  const { data, error } = await admin
    .from("showcase_posts")
    .select("id,user_id,image_url,title,impact_statement,boost_count,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[raid-showcase] feed query error:", error.message);
    return Response.json({ error: "Failed to load feed." }, { status: 500 });
  }

  try {
    const posts = await withShowcaseAuthors(admin, (data ?? []) as ShowcasePostRow[]);
    return Response.json({ posts });
  } catch (profileError) {
    console.error("[raid-showcase] author projection error:", profileError);
    const posts = ((data ?? []) as ShowcasePostRow[]).map((row) => ({
      ...row,
      author: null,
    }));
    return Response.json({ posts });
  }
}

export async function POST(request: NextRequest) {
  const viewerId = await getViewerIdFromAuthHeader(request);
  if (!viewerId) {
    return Response.json({ error: "Missing auth token." }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  let title: string | null = null;
  let impactStatement: string | null = null;
  let imageUrl: string | null = null;
  let file: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const titleField = formData.get("title");
    const impactField = formData.get("impact_statement");
    const imageUrlField = formData.get("image_url");
    const fileField = formData.get("file");

    title = typeof titleField === "string" ? titleField : null;
    impactStatement = typeof impactField === "string" ? impactField : null;
    imageUrl = typeof imageUrlField === "string" ? imageUrlField : null;
    file = fileField instanceof File ? fileField : null;

    // Never trust user-supplied URLs.
    imageUrl = sanitizeHttpsUrl(imageUrl);
  } else {
    const json = (await request.json().catch(() => null)) as
      | {
          title?: unknown;
          impact_statement?: unknown;
          image_url?: unknown;
        }
      | null;

    title = typeof json?.title === "string" ? json.title : null;
    impactStatement =
      typeof json?.impact_statement === "string" ? json.impact_statement : null;
    imageUrl = typeof json?.image_url === "string" ? json.image_url : null;

    // Never trust user-supplied URLs.
    imageUrl = sanitizeHttpsUrl(imageUrl);
  }

  title = title?.trim() ?? "";
  impactStatement = impactStatement?.trim() ?? "";

  if (!title) {
    return Response.json({ error: "Title is required." }, { status: 400 });
  }

  if (title.length > MAX_TITLE) {
    return Response.json(
      { error: `Title must be <= ${MAX_TITLE} characters.` },
      { status: 400 },
    );
  }

  if (!impactStatement) {
    return Response.json(
      { error: "Impact statement is required." },
      { status: 400 },
    );
  }

  if (impactStatement.length > MAX_IMPACT) {
    return Response.json(
      { error: `Impact statement must be <= ${MAX_IMPACT} characters.` },
      { status: 400 },
    );
  }

  const admin = supabaseAdminClient();

  // Require users to complete their profile before posting.
  // showcase_posts.user_id has a FK to public.profiles(user_id), so users without
  // a profiles row will fail with a FK violation.
  const { data: existingProfile, error: profileLookupError } = await admin
    .from("profiles")
    .select("handle")
    .eq("user_id", viewerId)
    .maybeSingle();

  if (profileLookupError) {
    console.error("[raid-showcase] profile lookup error:", profileLookupError.message);
    return Response.json({ error: "Failed to verify profile." }, { status: 500 });
  }

  if (!existingProfile) {
    return Response.json(
      {
        error:
          "Please complete your profile before posting to Raid Showcase (Profiles → Profile Completion).",
      },
      { status: 403 },
    );
  }

  if (file) {
    if (file.size > MAX_UPLOAD_BYTES) {
      return Response.json(
        {
          error: `File too large. Max size is ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB.`,
        },
        { status: 413 },
      );
    }

    let mimeType = file.type;
    let extension = mimeType ? extensionForImageMimeType(mimeType) : null;

    // If the client didn't provide a MIME type, fall back to the filename extension.
    if (!mimeType) {
      const ext = extensionFromFilename(file.name);
      if (!ext || !ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
        return Response.json(
          {
            error: `Unsupported file type. Allowed extensions: ${Array.from(ALLOWED_IMAGE_EXTENSIONS).join(
              ", ",
            )}.`,
          },
          { status: 400 },
        );
      }

      mimeType = mimeTypeForImageExtension(ext) ?? "";
      extension = ext === "jpeg" ? "jpg" : ext;
    }

    if (!mimeType || !extension || !ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
      return Response.json(
        {
          error: `Unsupported file type. Allowed: ${Array.from(ALLOWED_IMAGE_MIME_TYPES).join(
            ", ",
          )}.`,
        },
        { status: 400 },
      );
    }

    const objectPath = `raid-showcase/${viewerId}/${crypto.randomUUID()}.${extension}`;

    // Note: arrayBuffer() reads the whole file into memory; keep MAX_UPLOAD_BYTES small.
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await admin.storage
      .from("modules")
      .upload(objectPath, buffer, {
        upsert: false,
        contentType: mimeType,
      });

    if (uploadError) {
      console.error("[raid-showcase] upload error:", uploadError.message);
      return Response.json({ error: "Failed to upload image." }, { status: 500 });
    }

    const { data: publicData } = admin.storage
      .from("modules")
      .getPublicUrl(objectPath);
    imageUrl = publicData.publicUrl;
  }

  if (!imageUrl) {
    return Response.json(
      { error: "Image is required (upload a file or provide image_url)." },
      { status: 400 },
    );
  }

  const { data: inserted, error: insertError } = await admin
    .from("showcase_posts")
    .insert({
      user_id: viewerId,
      image_url: imageUrl,
      title,
      impact_statement: impactStatement,
    })
    .select("id,user_id,image_url,title,impact_statement,boost_count,created_at")
    .single();

  if (insertError) {
    console.error("[raid-showcase] insert error:", insertError.message);
    return Response.json({ error: "Failed to create post." }, { status: 500 });
  }

  let post = inserted as ShowcasePostRow | (ShowcasePostRow & { author: ShowcaseAuthor | null });
  try {
    const [enriched] = await withShowcaseAuthors(admin, [inserted as ShowcasePostRow]);
    post = enriched ?? inserted;
  } catch (profileError) {
    console.error("[raid-showcase] author projection error:", profileError);
    post = { ...(inserted as ShowcasePostRow), author: null };
  }

  return Response.json({ post }, { status: 201 });
}
