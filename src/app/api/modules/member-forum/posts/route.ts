import { NextRequest } from "next/server";
import {
  asUntypedAdmin,
  canWriteSpace,
  getViewer,
  getVisibleSpaces,
  jsonError,
  sanitizePostForResponse,
  type ForumPost,
} from "@/app/api/modules/member-forum/lib";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(request: NextRequest) {
  try {
    const viewer = await getViewer(request);
    const params = new URL(request.url).searchParams;
    const spaceSlug = params.get("space")?.trim();
    const cursor = params.get("cursor")?.trim();
    const [cursorCreatedAt, cursorId] = cursor?.split("|") ?? [];
    if (cursor) {
      const cursorDateValid = !!cursorCreatedAt && !Number.isNaN(Date.parse(cursorCreatedAt));
      const cursorIdValid = !!cursorId && isUuid(cursorId);
      if (!cursorDateValid || !cursorIdValid) {
        return jsonError("Invalid cursor.", 400);
      }
    }
    const sort = params.get("sort")?.trim() || "new";
    const parsedLimit = Number(params.get("limit") ?? DEFAULT_LIMIT);
    const limit = Number.isFinite(parsedLimit)
      ? Math.max(1, Math.min(MAX_LIMIT, Math.trunc(parsedLimit)))
      : DEFAULT_LIMIT;

    const visibleSpaces = await getVisibleSpaces(viewer, spaceSlug || undefined);
    const visibleSpaceIds = visibleSpaces.map((space) => space.id);
    if (!visibleSpaceIds.length) {
      return Response.json({ posts: [], next_cursor: null });
    }

    const admin = asUntypedAdmin(viewer.admin);
    const query = admin
      .from("forum_posts")
      .select("id,space_id,author_id,title,body_md,is_locked,is_deleted,created_at,updated_at")
      .eq("is_deleted", false)
      .in("space_id", visibleSpaceIds)
      .order("created_at", { ascending: sort === "old" })
      .order("id", { ascending: sort === "old" })
      .limit(limit + 1);

    if (cursorCreatedAt && cursorId) {
      if (sort === "old") {
        query.or(
          `created_at.gt.${cursorCreatedAt},and(created_at.eq.${cursorCreatedAt},id.gt.${cursorId})`,
        );
      } else {
        query.or(
          `created_at.lt.${cursorCreatedAt},and(created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`,
        );
      }
    }

    const { data, error } = await query;
    if (error) {
      return jsonError(error.message, 500);
    }

    const rows = (data ?? []) as ForumPost[];
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    const spaceById = new Map(visibleSpaces.map((space) => [space.id, space]));

    return Response.json({
      posts: items.map((post) => ({
        ...sanitizePostForResponse(post),
        space: spaceById.get(post.space_id) ?? null,
      })),
      next_cursor:
        hasMore && items.length
          ? `${items[items.length - 1].created_at}|${items[items.length - 1].id}`
          : null,
    });
  } catch (err) {
    console.error("[member-forum] posts list error:", err);
    return jsonError("Failed to load posts.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const viewer = await getViewer(request);
    if (!viewer.userId) {
      return jsonError("Authentication required.", 401);
    }

    const body = (await request.json().catch(() => null)) as
      | {
          space_slug?: unknown;
          title?: unknown;
          body_md?: unknown;
        }
      | null;

    const spaceSlug = asString(body?.space_slug);
    const title = asString(body?.title);
    const rawBodyMd = typeof body?.body_md === "string" ? body.body_md : "";
    const bodyMdTrimmed = rawBodyMd.trim();

    if (!spaceSlug) return jsonError("space_slug is required.");
    if (!title) return jsonError("title is required.");
    if (!bodyMdTrimmed) return jsonError("body_md is required.");

    const visibleSpaces = await getVisibleSpaces(viewer, spaceSlug);
    const space = visibleSpaces[0];
    if (!space) {
      return jsonError("Space not found.", 404);
    }
    if (!canWriteSpace(space, viewer)) {
      return jsonError("Write access denied.", 403);
    }

    const admin = asUntypedAdmin(viewer.admin);
    const { data, error } = await admin
      .from("forum_posts")
      .insert({
        space_id: space.id,
        author_id: viewer.userId,
        title,
        body_md: rawBodyMd,
      })
      .select("id,space_id,author_id,title,body_md,is_locked,is_deleted,created_at,updated_at")
      .single();

    if (error || !data) {
      return jsonError(error?.message || "Failed to create post.", 500);
    }

    return Response.json({
      post: {
        ...sanitizePostForResponse(data as ForumPost),
        space,
      },
    });
  } catch (err) {
    console.error("[member-forum] create post error:", err);
    return jsonError("Failed to create post.", 500);
  }
}
