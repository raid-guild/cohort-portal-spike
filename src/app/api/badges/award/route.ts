import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";
import { emitPortalEvent } from "@/lib/portal-events";

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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const handle = body?.handle ? String(body.handle).trim() : null;
  const userId = body?.userId ? String(body.userId).trim() : null;
  const handles = Array.isArray(body?.handles)
    ? body.handles
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean)
    : [];
  const userIds = Array.isArray(body?.userIds)
    ? body.userIds
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean)
    : [];
  const badgeId = String(body?.badgeId ?? "")
    .trim()
    .toLowerCase();
  const note = body?.note ? String(body.note).trim() : null;

  if (!badgeId) {
    return Response.json({ error: "badgeId is required." }, { status: 400 });
  }

  const pendingHandles = [...handles, ...(handle ? [handle] : [])];
  const pendingUserIds = [...userIds, ...(userId ? [userId] : [])];

  if (!pendingHandles.length && !pendingUserIds.length) {
    return Response.json(
      { error: "Provide userId or a handle with a linked user_id." },
      { status: 400 },
    );
  }

  const resolvedUserIds = new Set(pendingUserIds);
  if (pendingHandles.length) {
    const { data: profileRows, error: profileError } = await admin
      .from("profiles")
      .select("handle, user_id")
      .in("handle", pendingHandles);

    if (profileError) {
      return Response.json({ error: profileError.message }, { status: 500 });
    }

    const byHandle = new Map(
      (profileRows ?? []).map((row) => [row.handle, row.user_id]),
    );
    const missingHandles = pendingHandles.filter(
      (candidate) => !byHandle.get(candidate),
    );
    if (missingHandles.length) {
      return Response.json(
        {
          error: `Unknown handle(s) or missing linked user_id: ${missingHandles.join(", ")}`,
        },
        { status: 400 },
      );
    }

    for (const candidate of pendingHandles) {
      const resolved = byHandle.get(candidate);
      if (resolved) resolvedUserIds.add(resolved);
    }
  }

  const rows = [...resolvedUserIds].map((resolvedId) => ({
    user_id: resolvedId,
    badge_id: badgeId,
    awarded_by: data.user.id,
    note,
  }));

  const { error: insertError } = await admin
    .from("user_badges")
    .upsert(rows, { onConflict: "user_id,badge_id" });

  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 500 });
  }

  const { data: badgeDef } = await admin
    .from("badge_definitions")
    .select("title")
    .eq("id", badgeId)
    .maybeSingle();

  try {
    await emitPortalEvent({
      moduleId: "badges",
      kind: "core.badges.bulk_awarded",
      authenticatedUserId: data.user.id,
      actorId: data.user.id,
      subject: { type: "badge", id: badgeId },
      visibility: "authenticated",
      data: {
        badgeId,
        badgeTitle: badgeDef?.title ?? badgeId,
        userIds: [...resolvedUserIds],
        handles: pendingHandles,
        note: note ?? null,
        source: "badges-award-api",
      },
      dedupeKey: `badge_award:${badgeId}:${[...resolvedUserIds].sort().join(",")}`,
    });
  } catch (emitError) {
    console.error("[badges] emit bulk_awarded failed:", emitError);
  }

  return Response.json({ ok: true, awarded: rows.length });
}
