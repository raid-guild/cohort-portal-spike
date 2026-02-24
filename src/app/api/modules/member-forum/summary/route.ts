import { NextRequest } from "next/server";
import {
  asUntypedAdmin,
  getViewer,
  getVisibleSpaces,
  jsonError,
  type ForumPost,
} from "@/app/api/modules/member-forum/lib";

export async function GET(request: NextRequest) {
  try {
    const viewer = await getViewer(request);
    const spaces = await getVisibleSpaces(viewer);
    const spaceIds = spaces.map((space) => space.id);

    if (!spaceIds.length) {
      return Response.json({
        title: "Member Forum",
        items: [
          { label: "Visible spaces", value: "0" },
          { label: "Recent posts", value: "0" },
          { label: "Latest", value: "No visible posts." },
        ],
      });
    }

    const admin = asUntypedAdmin(viewer.admin);
    const [countRes, latestRes] = await Promise.all([
      admin
        .from("forum_posts")
        .select("id", { count: "exact", head: true })
        .eq("is_deleted", false)
        .in("space_id", spaceIds),
      admin
        .from("forum_posts")
        .select("id,title,space_id,created_at")
        .eq("is_deleted", false)
        .in("space_id", spaceIds)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (countRes.error || latestRes.error) {
      return jsonError(countRes.error?.message || latestRes.error?.message || "Failed to load summary.", 500);
    }

    const latest = latestRes.data as Pick<ForumPost, "title" | "created_at" | "space_id"> | null;
    const spaceById = new Map(spaces.map((space) => [space.id, space]));
    const latestLabel = latest
      ? `${latest.title} (${spaceById.get(latest.space_id)?.slug ?? "space"})`
      : "No visible posts.";

    return Response.json({
      title: "Member Forum",
      items: [
        { label: "Visible spaces", value: String(spaces.length) },
        { label: "Recent posts", value: String(countRes.count ?? 0) },
        { label: "Latest", value: latestLabel },
      ],
    });
  } catch (err) {
    console.error("[member-forum] summary error:", err);
    return jsonError("Failed to load summary.", 500);
  }
}
