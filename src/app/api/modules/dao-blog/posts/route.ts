import { NextRequest } from "next/server";
import {
  asString,
  asUntypedAdmin,
  canAuthor,
  jsonError,
  parseLimit,
  requireViewer,
  toKebabCase,
  validatePostPayload,
  type DaoBlogPost,
} from "@/app/api/modules/dao-blog/lib";
import { supabaseAdminClient } from "@/lib/supabase/admin";

type PostListItem = Pick<
  DaoBlogPost,
  "id" | "title" | "slug" | "summary" | "header_image_url" | "published_at" | "author_user_id" | "status"
>;

export async function GET(request: NextRequest) {
  try {
    const params = new URL(request.url).searchParams;
    const limit = parseLimit(params.get("limit"), 20, 50);
    const cursor = params.get("cursor")?.trim();
    const author = params.get("author")?.trim();

    const [cursorPublishedAt, cursorId] = cursor?.split("|") ?? [];

    const admin = asUntypedAdmin(supabaseAdminClient());
    const query = admin
      .from("dao_blog_posts")
      .select(
        "id,title,slug,summary,header_image_url,published_at,author_user_id,status,deleted_at",
      )
      .eq("status", "published")
      .is("deleted_at", null)
      .order("published_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);

    if (author) {
      query.eq("author_user_id", author);
    }

    if (cursorPublishedAt && cursorId) {
      query.or(
        `published_at.lt.${cursorPublishedAt},and(published_at.eq.${cursorPublishedAt},id.lt.${cursorId})`,
      );
    }

    const { data, error } = await query;
    if (error) {
      return jsonError(`Failed to load posts: ${error.message}`, 500);
    }

    const rows = ((data ?? []) as (PostListItem & { deleted_at: string | null })[]).filter(
      (row) => !row.deleted_at,
    );
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return Response.json({
      posts: items,
      next_cursor:
        hasMore && items.length
          ? `${items[items.length - 1].published_at}|${items[items.length - 1].id}`
          : null,
    });
  } catch (err) {
    console.error("[dao-blog] list posts error:", err);
    return jsonError("Failed to load posts.", 500);
  }
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

    const body = (await request.json().catch(() => null)) as
      | {
          title?: unknown;
          slug?: unknown;
          summary?: unknown;
          header_image_url?: unknown;
          body_md?: unknown;
          header_image_mime_type?: unknown;
          header_image_size_bytes?: unknown;
        }
      | null;

    const title = asString(body?.title);
    const slug = asString(body?.slug);
    const summary = asString(body?.summary);
    const headerImageUrl = asString(body?.header_image_url);
    const bodyMd = asString(body?.body_md);
    const headerImageMimeType = asString(body?.header_image_mime_type);
    const headerImageSizeBytes =
      typeof body?.header_image_size_bytes === "number" && Number.isFinite(body.header_image_size_bytes)
        ? body.header_image_size_bytes
        : null;

    const validationError = validatePostPayload({
      title,
      slug,
      summary,
      headerImageUrl,
      bodyMd,
      headerImageMimeType,
      headerImageSizeBytes,
    });

    if (validationError) {
      return jsonError(validationError);
    }

    const normalizedSlug = toKebabCase(slug as string);
    const admin = asUntypedAdmin(viewer.admin);

    const { data, error } = await admin
      .from("dao_blog_posts")
      .insert({
        title,
        slug: normalizedSlug,
        summary,
        header_image_url: headerImageUrl,
        body_md: bodyMd,
        status: "draft",
        author_user_id: viewer.userId,
      })
      .select(
        "id,title,slug,summary,header_image_url,body_md,status,published_at,author_user_id,review_submitted_at,reviewed_at,reviewed_by,review_notes,created_at,updated_at,deleted_at",
      )
      .single();

    if (error || !data) {
      if (error?.message.toLowerCase().includes("duplicate") || error?.message.includes("dao_blog_posts_slug_key")) {
        return jsonError("Slug already exists.", 409);
      }
      return jsonError(error?.message || "Failed to create post.", 500);
    }

    return Response.json({ post: data as DaoBlogPost });
  } catch (err) {
    console.error("[dao-blog] create post error:", err);
    return jsonError("Failed to create post.", 500);
  }
}
