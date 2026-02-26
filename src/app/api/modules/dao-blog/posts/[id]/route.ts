import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import {
  asString,
  asUntypedAdmin,
  isHostRole,
  jsonError,
  loadPostById,
  toKebabCase,
  validatePostPayload,
} from "@/app/api/modules/dao-blog/lib";
import { requireViewer } from "@/app/api/modules/dao-blog/lib";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolved = await params;
    const id = resolved.id.trim();

    if (!id) {
      return jsonError("id is required.");
    }

    const post = await loadPostById(supabaseAdminClient(), id);

    if (!post || post.deleted_at || post.status !== "published") {
      return jsonError("Post not found.", 404);
    }

    return Response.json({ post });
  } catch (err) {
    console.error("[dao-blog] get by id error:", err);
    return jsonError("Failed to load post.", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const viewer = await requireViewer(request);
    if ("error" in viewer) {
      return jsonError(viewer.error, viewer.status);
    }

    const resolved = await params;
    const post = await loadPostById(viewer.admin, resolved.id);

    if (!post || post.deleted_at) {
      return jsonError("Post not found.", 404);
    }

    const host = isHostRole(viewer.roles);
    const isAuthor = post.author_user_id === viewer.userId;

    if (!isAuthor && !host) {
      return jsonError("Edit access denied.", 403);
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

    const requestedSlug = asString(body?.slug);
    if (requestedSlug && requestedSlug !== post.slug) {
      return jsonError("Slug is immutable after create.", 400);
    }

    const nextTitle = asString(body?.title) ?? post.title;
    const nextSummary = asString(body?.summary) ?? post.summary;
    const nextHeaderImageUrl = asString(body?.header_image_url) ?? post.header_image_url;
    const nextBodyMd = asString(body?.body_md) ?? post.body_md;
    const nextSlug = requestedSlug ? toKebabCase(requestedSlug) : post.slug;
    const headerImageMimeType = asString(body?.header_image_mime_type);
    const headerImageSizeBytes =
      typeof body?.header_image_size_bytes === "number" && Number.isFinite(body.header_image_size_bytes)
        ? body.header_image_size_bytes
        : null;

    const validationError = validatePostPayload({
      title: nextTitle,
      slug: nextSlug,
      summary: nextSummary,
      headerImageUrl: nextHeaderImageUrl,
      bodyMd: nextBodyMd,
      headerImageMimeType,
      headerImageSizeBytes,
    });
    if (validationError) {
      return jsonError(validationError);
    }

    const admin = asUntypedAdmin(viewer.admin);
    const { data, error } = await admin
      .from("dao_blog_posts")
      .update({
        title: nextTitle,
        summary: nextSummary,
        header_image_url: nextHeaderImageUrl,
        body_md: nextBodyMd,
      })
      .eq("id", resolved.id)
      .select(
        "id,title,slug,summary,header_image_url,body_md,status,published_at,author_user_id,review_submitted_at,reviewed_at,reviewed_by,review_notes,created_at,updated_at,deleted_at",
      )
      .single();

    if (error || !data) {
      return jsonError(error?.message || "Failed to update post.", 500);
    }

    return Response.json({ post: data });
  } catch (err) {
    console.error("[dao-blog] patch post error:", err);
    return jsonError("Failed to update post.", 500);
  }
}
