import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = supabaseAdminClient();
  const { data, error } = await admin
    .from("badge_definitions")
    .select("id, title, description, image_url, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ badges: data ?? [] });
}

export async function POST(request: NextRequest) {
  // Create/update a badge definition (host-only)
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Missing auth token." }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");

  const admin = supabaseAdminClient();

  // Verify host role
  const { data: user, error: userError } = await admin.auth.getUser(token);
  if (userError || !user.user) {
    return Response.json({ error: "Invalid auth token." }, { status: 401 });
  }

  const { data: roleRows, error: roleError } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.user.id);

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

  const id = String(body?.id ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  const title = String(body?.title ?? "").trim();
  const description = body?.description ? String(body.description).trim() : null;
  const imageUrl = body?.imageUrl ? String(body.imageUrl).trim() : null;
  const sortOrder = Number.isFinite(Number(body?.sortOrder))
    ? Number(body.sortOrder)
    : 0;

  if (!id || !title) {
    return Response.json(
      { error: "id and title are required." },
      { status: 400 },
    );
  }

  const { error: upsertError } = await admin.from("badge_definitions").upsert(
    {
      id,
      title,
      description,
      image_url: imageUrl,
      sort_order: sortOrder,
      is_active: true,
    },
    { onConflict: "id" },
  );

  if (upsertError) {
    return Response.json({ error: upsertError.message }, { status: 500 });
  }

  return Response.json({ ok: true, id });
}
