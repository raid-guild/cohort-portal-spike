import { NextRequest } from "next/server";
import { requireAuth, jsonError } from "@/app/api/modules/guild-grimoire/lib";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return jsonError(auth.error, auth.status ?? 401);
  }

  const myCount = await auth.admin
    .from("guild_grimoire_notes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.userId)
    .is("deleted_at", null);

  const latestShared = await auth.admin
    .from("guild_grimoire_notes")
    .select("content_type,text_content,created_at")
    .is("deleted_at", null)
    .in("visibility", ["shared", "public", "cohort"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const anyError = myCount.error || latestShared.error;
  if (anyError) {
    console.error("[guild-grimoire] summary error:", anyError.message);
    return jsonError("Failed to load summary.", 500);
  }

  const latest = latestShared.data;
  const latestLabel = latest
    ? latest.content_type === "text"
      ? (latest.text_content ?? "").slice(0, 140)
      : `${latest.content_type} note`
    : "No shared notes yet.";

  return Response.json({
    title: "Guild Grimoire",
    items: [
      { label: "My notes", value: String(myCount.count ?? 0) },
      { label: "Latest", value: latestLabel },
    ],
  });
}
