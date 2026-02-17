import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";

async function getViewerIdFromAuthHeader(
  request: NextRequest,
): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return null;
  }

  const supabase = supabaseServerClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }
  return data.user.id;
}

export async function GET(request: NextRequest) {
  const viewerId = await getViewerIdFromAuthHeader(request);
  if (!viewerId) {
    return Response.json({
      title: "Timeline",
      items: [
        { label: "Entries", value: "0" },
        { label: "Latest", value: "—" },
      ],
    });
  }

  const supabase = supabaseAdminClient();
  const [{ count, error: countError }, { data: latest, error: latestError }] =
    await Promise.all([
      supabase
        .from("timeline_entries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", viewerId)
        .is("deleted_at", null),
      supabase
        .from("timeline_entries")
        .select("title")
        .eq("user_id", viewerId)
        .is("deleted_at", null)
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
      { label: "Entries", value: String(count ?? 0) },
      { label: "Latest", value: latest?.title ?? "—" },
    ],
  });
}
