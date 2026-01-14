import { NextRequest } from "next/server";
import { filterAnnouncements } from "@/lib/announcements";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
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

  const supabase = supabaseAdminClient();
  if (viewerId) {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", viewerId);
    roles = data?.map((row) => row.role) ?? [];
  }

  const { data, error } = await supabase
    .from("announcements")
    .select(
      "id, title, body, status, audience, role_targets, starts_at, ends_at, created_at, created_by, updated_at",
    )
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const filtered = filterAnnouncements(data ?? [], { roles, viewerId });

  return Response.json({ announcements: filtered });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Missing auth token." }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = supabaseServerClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return Response.json({ error: "Invalid auth token." }, { status: 401 });
  }

  const admin = supabaseAdminClient();
  const { data: roleRows, error: roleError } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);

  if (roleError) {
    return Response.json({ error: roleError.message }, { status: 500 });
  }

  const roles = roleRows?.map((row) => row.role) ?? [];
  const isHost = roles.includes("host");
  if (!roles.length) {
    return Response.json({ error: "Role required to publish." }, { status: 403 });
  }

  const body = await request.json();
  const title = String(body?.title ?? "").trim();
  const message = String(body?.body ?? "").trim();
  const status = String(body?.status ?? "draft");
  const audience = String(body?.audience ?? "public");
  const roleTargets =
    Array.isArray(body?.roleTargets) && body.roleTargets.length
      ? (body.roleTargets as string[])
      : null;
  const startsAt = body?.startsAt ? String(body.startsAt) : null;
  const endsAt = body?.endsAt ? String(body.endsAt) : null;

  if (!title || !message) {
    return Response.json({ error: "Title and body are required." }, { status: 400 });
  }

  if (!["draft", "published"].includes(status)) {
    return Response.json({ error: "Invalid status." }, { status: 400 });
  }

  if (!["public", "authenticated", "host"].includes(audience)) {
    return Response.json({ error: "Invalid audience." }, { status: 400 });
  }

  if (audience === "public" && !isHost) {
    return Response.json(
      { error: "Only hosts can publish to public." },
      { status: 403 },
    );
  }

  if (audience === "host" && !isHost) {
    return Response.json(
      { error: "Host role required for host announcements." },
      { status: 403 },
    );
  }

  const resolvedRoleTargets = isHost ? roleTargets : roles;

  const { data: inserted, error: insertError } = await admin
    .from("announcements")
    .insert({
      title,
      body: message,
      status,
      audience,
      role_targets: resolvedRoleTargets,
      starts_at: startsAt,
      ends_at: endsAt,
      created_by: data.user.id,
    })
    .select(
      "id, title, body, status, audience, role_targets, starts_at, ends_at, created_at, created_by, updated_at",
    )
    .maybeSingle();

  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 500 });
  }

  return Response.json({ announcement: inserted });
}
