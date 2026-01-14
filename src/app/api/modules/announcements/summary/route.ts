import { filterAnnouncements } from "@/lib/announcements";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  let viewerId: string | null = null;
  let roles: string[] = [];

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const supabase = supabaseServerClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data.user) {
      viewerId = data.user.id;
    }
  }

  const admin = supabaseAdminClient();
  if (viewerId) {
    const { data } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", viewerId);
    roles = data?.map((row) => row.role) ?? [];
  }

  const { data, error } = await admin
    .from("announcements")
    .select(
      "id, title, body, status, audience, role_targets, starts_at, ends_at, created_at, created_by, updated_at",
    )
    .eq("status", "published");

  if (error) {
    return Response.json({ title: "Announcements", items: [] });
  }

  const filtered = filterAnnouncements(data ?? [], { roles, viewerId });
  const sorted = [...filtered].sort((a, b) => {
    const aTime = new Date(a.starts_at ?? a.created_at ?? 0).valueOf();
    const bTime = new Date(b.starts_at ?? b.created_at ?? 0).valueOf();
    return bTime - aTime;
  });
  const latest = sorted.slice(0, 3).map((row) => {
    const body = row.body?.trim() ?? "";
    const preview = body.length > 120 ? `${body.slice(0, 117)}...` : body;
    return {
      label: row.title || "Announcement",
      value: preview || row.title || "Announcement",
    };
  });

  return Response.json({
    title: "Announcements",
    items: [
      ...latest,
      { label: "Published", value: String(filtered.length) },
    ],
  });
}
