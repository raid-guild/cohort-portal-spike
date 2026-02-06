import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";

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
  if (!roles.includes("host")) {
    return Response.json({ error: "Host role required." }, { status: 403 });
  }

  const body = await request.json();
  const handle = body?.handle ? String(body.handle).trim() : null;
  const userId = body?.userId ? String(body.userId).trim() : null;
  const badgeId = String(body?.badgeId ?? "")
    .trim()
    .toLowerCase();
  const note = body?.note ? String(body.note).trim() : null;

  if (!badgeId) {
    return Response.json({ error: "badgeId is required." }, { status: 400 });
  }

  let resolvedUserId = userId;
  if (!resolvedUserId && handle) {
    const { data: profileRow, error: profileError } = await admin
      .from("profiles")
      .select("user_id")
      .eq("handle", handle)
      .maybeSingle();

    if (profileError) {
      return Response.json({ error: profileError.message }, { status: 500 });
    }

    resolvedUserId = profileRow?.user_id ?? null;
  }

  if (!resolvedUserId) {
    return Response.json(
      { error: "Provide userId or a handle with a linked user_id." },
      { status: 400 },
    );
  }

  const { error: insertError } = await admin.from("user_badges").upsert(
    {
      user_id: resolvedUserId,
      badge_id: badgeId,
      awarded_by: data.user.id,
      note,
    },
    { onConflict: "user_id,badge_id" },
  );

  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
