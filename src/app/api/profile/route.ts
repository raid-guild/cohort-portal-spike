import { NextRequest } from "next/server";
import { loadRegistry } from "@/lib/registry";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";

type ProfileWriteRequest = {
  moduleId?: string;
  fields?: Record<string, string>;
};

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Missing auth token." }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = supabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return Response.json({ error: "Invalid auth token." }, { status: 401 });
  }

  const body = (await request.json()) as ProfileWriteRequest;
  const moduleId = String(body?.moduleId ?? "").trim();
  const fields = body?.fields ?? {};

  if (!moduleId) {
    return Response.json({ error: "Missing moduleId." }, { status: 400 });
  }

  if (!Object.keys(fields).length) {
    return Response.json({ error: "No fields provided." }, { status: 400 });
  }

  const registry = loadRegistry();
  const module = registry.modules.find((entry) => entry.id === moduleId);
  if (!module?.capabilities?.profileWrite?.fields?.length) {
    return Response.json({ error: "Profile write not allowed." }, { status: 403 });
  }

  const allowed = new Set(module.capabilities.profileWrite.fields);
  const invalid = Object.keys(fields).filter((key) => !allowed.has(key));
  if (invalid.length) {
    return Response.json({ error: "Invalid profile fields." }, { status: 403 });
  }

  const admin = supabaseAdminClient();
  const { data: existing, error: lookupError } = await admin
    .from("profiles")
    .select("handle")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (lookupError || !existing) {
    return Response.json({ error: "Profile not found." }, { status: 404 });
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update(fields)
    .eq("user_id", userData.user.id);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Missing auth token." }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = supabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return Response.json({ error: "Invalid auth token." }, { status: 401 });
  }

  const admin = supabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("display_name, bio")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ profile: data });
}
