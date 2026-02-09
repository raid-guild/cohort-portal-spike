import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { getViewerIdFromAuthHeader } from "@/app/api/modules/raider-timeline/lib";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const handle = String(url.searchParams.get("handle") ?? "").trim();
  if (!handle) {
    return Response.json({ error: "Missing handle." }, { status: 400 });
  }

  const viewerId = await getViewerIdFromAuthHeader(request);
  const supabase = supabaseAdminClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("handle", handle)
    .maybeSingle();

  if (profileError) {
    return Response.json({ error: profileError.message }, { status: 500 });
  }

  const userId = profile?.user_id ?? null;
  if (!userId) {
    return Response.json({ title: "Timeline", items: [{ label: "Entries", value: "0" }] });
  }

  const visibilityFilter = !viewerId
    ? ["public"]
    : viewerId === userId
      ? ["public", "authenticated", "private"]
      : ["public", "authenticated"];

  const [{ count, error: countError }, { data: latest, error: latestError }] =
    await Promise.all([
      supabase
        .from("timeline_entries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("deleted_at", null)
        .in("visibility", visibilityFilter),
      supabase
        .from("timeline_entries")
        .select("title")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .in("visibility", visibilityFilter)
        .order("pinned", { ascending: false })
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (countError || latestError) {
    return Response.json(
      { error: (countError ?? latestError)?.message ?? "Unknown error" },
      { status: 500 },
    );
  }

  return Response.json({
    title: "Timeline",
    items: [
      ...(latest?.title
        ? [{ label: "Latest", value: latest.title }]
        : [{ label: "Latest", value: "No public entries yet." }]),
      { label: "Entries", value: String(count ?? 0) },
    ],
  });
}
