import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";

function hashKey(key: string) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

async function verifyModuleKey(moduleId: string, moduleKey: string) {
  const supabase = supabaseAdminClient();
  const { data, error } = await supabase
    .from("module_keys")
    .select("key_hash")
    .eq("module_id", moduleId)
    .maybeSingle();
  if (error || !data) {
    return false;
  }
  return data.key_hash === hashKey(moduleKey);
}

async function getUserIdFromAuth(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.replace("Bearer ", "");
  const supabase = supabaseServerClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }
  return data.user.id;
}

export async function POST(request: NextRequest) {
  const moduleId = request.headers.get("x-module-id");
  const moduleKey = request.headers.get("x-module-key");

  if (!moduleId || !moduleKey) {
    return Response.json(
      { error: "Missing x-module-id or x-module-key." },
      { status: 401 },
    );
  }

  const isValid = await verifyModuleKey(moduleId, moduleKey);
  if (!isValid) {
    return Response.json({ error: "Invalid module key." }, { status: 403 });
  }

  const body = await request.json();
  const { userId, visibility, payload } = body ?? {};
  if (!userId || !payload) {
    return Response.json(
      { error: "Missing userId or payload." },
      { status: 400 },
    );
  }

  const safeVisibility =
    visibility === "public" ||
    visibility === "authenticated" ||
    visibility === "private" ||
    visibility === "admin"
      ? visibility
      : "private";

  const supabase = supabaseAdminClient();
  const { error } = await supabase.from("module_data").upsert(
    {
      module_id: moduleId,
      user_id: userId,
      visibility: safeVisibility,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "module_id,user_id" },
  );

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const moduleId = url.searchParams.get("module_id");
  const userIdParam = url.searchParams.get("user_id");
  const moduleKey = request.headers.get("x-module-key");

  if (!moduleId) {
    return Response.json(
      { error: "Missing module_id query param." },
      { status: 400 },
    );
  }

  let isModuleAuthorized = false;
  if (moduleKey) {
    isModuleAuthorized = await verifyModuleKey(moduleId, moduleKey);
  }

  const viewerId = await getUserIdFromAuth(request);
  const supabase = supabaseAdminClient();
  const { data, error } = await supabase
    .from("module_data")
    .select("module_id, user_id, visibility, payload, updated_at")
    .eq("module_id", moduleId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const filtered = data.filter((row) => {
    if (userIdParam && row.user_id !== userIdParam) {
      return false;
    }
    if (isModuleAuthorized) {
      return true;
    }
    if (row.visibility === "public") {
      return true;
    }
    if (row.visibility === "authenticated") {
      return Boolean(viewerId);
    }
    if (row.visibility === "private") {
      return viewerId === row.user_id;
    }
    if (row.visibility === "admin") {
      return false;
    }
    return false;
  });

  return Response.json({ data: filtered });
}
