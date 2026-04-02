import { NextRequest } from "next/server";
import { asString, asUntypedAdmin, jsonError, toKebabCase, validatePostPayload } from "@/app/api/modules/dao-blog/lib";
import { emitPortalEvent } from "@/lib/portal-events";
import { supabaseAdminClient } from "@/lib/supabase/admin";

const API_KEY = process.env.DAO_BLOG_INGEST_API_KEY ?? "";
const INGEST_USER_ID = process.env.DAO_BLOG_INGEST_USER_ID ?? "";
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_REQUESTS_PER_IP = 30;
const RATE_MAX_REQUESTS_PER_KEY = 120;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_IMAGE_HOSTS = new Set(
  [
    "images.unsplash.com",
    (() => {
      try {
        const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
        return raw ? new URL(raw).hostname : null;
      } catch {
        return null;
      }
    })(),
  ].filter((value): value is string => Boolean(value)),
);

const ipRateBuckets = new Map<string, number[]>();
const keyRateBuckets = new Map<string, number[]>();

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

function rateLimitCheck(bucketKey: string, maxRequests: number, map: Map<string, number[]>) {
  const now = Date.now();
  for (const [key, timestamps] of map.entries()) {
    const recentEntries = timestamps.filter((timestamp) => now - timestamp < RATE_WINDOW_MS);
    if (recentEntries.length === 0) {
      map.delete(key);
      continue;
    }
    if (recentEntries.length !== timestamps.length) {
      map.set(key, recentEntries);
    }
  }

  const bucket = map.get(bucketKey) ?? [];
  if (bucket.length >= maxRequests) {
    map.set(bucketKey, bucket);
    return false;
  }
  map.set(bucketKey, [...bucket, now]);
  return true;
}

function summarizeMarkdown(markdown: string) {
  const plainText = markdown
    .replace(/!\[[^\]]*]\(([^)]+)\)/g, " ")
    .replace(/\[[^\]]+]\(([^)]+)\)/g, " ")
    .replace(/[`*_>#-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!plainText) return null;
  return plainText.slice(0, 280);
}

function isAllowedHeaderImageUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  return parsed.protocol === "https:" && ALLOWED_IMAGE_HOSTS.has(parsed.hostname);
}

export async function POST(request: NextRequest) {
  try {
    if (!API_KEY || !INGEST_USER_ID) {
      return jsonError("Missing server configuration.", 500);
    }

    if (!UUID_RE.test(INGEST_USER_ID)) {
      return jsonError("Invalid server configuration.", 500);
    }

    const ip = getClientIp(request);
    if (!rateLimitCheck(ip, RATE_MAX_REQUESTS_PER_IP, ipRateBuckets)) {
      return jsonError("Too many requests.", 429);
    }

    const headerKey = request.headers.get("x-dao-blog-api-key");
    if (!headerKey || headerKey !== API_KEY) {
      return jsonError("Unauthorized.", 401);
    }

    if (!rateLimitCheck(headerKey, RATE_MAX_REQUESTS_PER_KEY, keyRateBuckets)) {
      return jsonError("Too many requests.", 429);
    }

    const body = (await request.json().catch(() => null)) as
      | {
          title?: unknown;
          slug?: unknown;
          summary?: unknown;
          header_image_url?: unknown;
          body_md?: unknown;
          author_name?: unknown;
          author_avatar_url?: unknown;
          publish?: unknown;
        }
      | null;

    const title = asString(body?.title);
    const bodyMd = asString(body?.body_md);
    const slug = asString(body?.slug) ?? (title ? toKebabCase(title) : null);
    const summary = asString(body?.summary) ?? (bodyMd ? summarizeMarkdown(bodyMd) : null);
    const headerImageUrl = asString(body?.header_image_url);
    const authorName = asString(body?.author_name);
    const authorAvatarUrl = asString(body?.author_avatar_url);
    const publish = body?.publish === true;

    if (!authorName) {
      return jsonError("author_name is required.");
    }
    if (headerImageUrl && !isAllowedHeaderImageUrl(headerImageUrl)) {
      return jsonError("header_image_url must be an https URL from an allowed image host.");
    }
    if (authorAvatarUrl && !isAllowedHeaderImageUrl(authorAvatarUrl)) {
      return jsonError("author_avatar_url must be an https URL from an allowed image host.");
    }

    const validationError = validatePostPayload({
      title,
      slug,
      summary,
      headerImageUrl,
      bodyMd,
      headerImageMimeType: null,
      headerImageSizeBytes: null,
    });

    if (validationError) {
      return jsonError(validationError);
    }

    const now = new Date().toISOString();
    const admin = asUntypedAdmin(supabaseAdminClient());

    const { data, error } = await admin
      .from("dao_blog_posts")
      .insert({
        title,
        slug,
        summary,
        header_image_url: headerImageUrl,
        body_md: bodyMd,
        external_author_name: authorName,
        external_author_avatar_url: authorAvatarUrl,
        status: publish ? "published" : "draft",
        published_at: publish ? now : null,
        author_user_id: INGEST_USER_ID,
        reviewed_at: publish ? now : null,
        reviewed_by: publish ? INGEST_USER_ID : null,
      })
      .select(
        "id,title,slug,summary,header_image_url,body_md,external_author_name,external_author_avatar_url,status,published_at,author_user_id,review_submitted_at,reviewed_at,reviewed_by,review_notes,created_at,updated_at,deleted_at",
      )
      .single();

    if (error || !data) {
      if ((error as { code?: string } | null)?.code === "23505") {
        return jsonError("Slug already exists.", 409);
      }
      return jsonError(error?.message || "Failed to create post.", 500);
    }

    if (publish) {
      try {
        await emitPortalEvent({
          moduleId: "dao-blog",
          kind: "core.dao_blog.post_published",
          authenticatedUserId: INGEST_USER_ID,
          actorId: INGEST_USER_ID,
          subject: { type: "dao_blog_post", id: (data as { id: string }).id },
          visibility: "public",
          data: {
            slug: (data as { slug: string }).slug,
            title: (data as { title: string }).title,
            publishedAt: (data as { published_at: string | null }).published_at,
          },
          dedupeKey: `dao_blog_post:${(data as { id: string }).id}:published`,
        });
      } catch (emitError) {
        console.error("[dao-blog] ingest post_published emit failed:", emitError);
      }
    }

    return Response.json({ post: data }, { status: 201 });
  } catch (err) {
    console.error("[dao-blog] ingest error:", err);
    return jsonError("Failed to ingest post.", 500);
  }
}
