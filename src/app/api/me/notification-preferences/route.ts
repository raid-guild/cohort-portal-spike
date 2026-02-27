import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";

type Cadence = "daily" | "weekly";

type PreferenceRow = {
  user_id: string;
  email_enabled: boolean;
  cadence: Cadence;
  blog_enabled: boolean;
  forum_enabled: boolean;
  grimoire_enabled: boolean;
  last_digest_sent_at: string | null;
  updated_at?: string;
};

type UntypedQuery = {
  select: (...args: unknown[]) => UntypedQuery;
  eq: (...args: unknown[]) => UntypedQuery;
  maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
  upsert: (...args: unknown[]) => Promise<{ error: { message: string } | null }>;
};

type UntypedAdmin = {
  from: (table: string) => UntypedQuery;
};

function asUntypedAdmin(admin: ReturnType<typeof supabaseAdminClient>): UntypedAdmin {
  return admin as unknown as UntypedAdmin;
}

function defaultPreferences(userId: string): PreferenceRow {
  return {
    user_id: userId,
    email_enabled: false,
    cadence: "daily",
    blog_enabled: false,
    forum_enabled: false,
    grimoire_enabled: false,
    last_digest_sent_at: null,
  };
}

async function getUserId(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.replace("Bearer ", "");
  const supabase = supabaseServerClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

function parseCadence(value: unknown): Cadence | null {
  return value === "weekly" ? "weekly" : value === "daily" ? "daily" : null;
}

export async function GET(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = asUntypedAdmin(supabaseAdminClient());
  const { data, error } = await admin
    .from("user_notification_preferences")
    .select(
      "user_id,email_enabled,cadence,blog_enabled,forum_enabled,grimoire_enabled,last_digest_sent_at,updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const preferences = (data as PreferenceRow | null) ?? defaultPreferences(userId);
  return Response.json({ preferences });
}

export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const cadence = parseCadence(body.cadence);
  if (body.cadence !== undefined && !cadence) {
    return Response.json({ error: "cadence must be daily or weekly." }, { status: 400 });
  }

  const admin = asUntypedAdmin(supabaseAdminClient());
  const { data: existing } = await admin
    .from("user_notification_preferences")
    .select("email_enabled,cadence,blog_enabled,forum_enabled,grimoire_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  const existingPref = (existing as Partial<PreferenceRow> | null) ?? {};
  const payload = {
    user_id: userId,
    email_enabled:
      typeof body.emailEnabled === "boolean"
        ? body.emailEnabled
        : (existingPref.email_enabled ?? false),
    cadence: cadence ?? existingPref.cadence ?? "daily",
    blog_enabled:
      typeof body.blogEnabled === "boolean"
        ? body.blogEnabled
        : (existingPref.blog_enabled ?? false),
    forum_enabled:
      typeof body.forumEnabled === "boolean"
        ? body.forumEnabled
        : (existingPref.forum_enabled ?? false),
    grimoire_enabled:
      typeof body.grimoireEnabled === "boolean"
        ? body.grimoireEnabled
        : (existingPref.grimoire_enabled ?? false),
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin
    .from("user_notification_preferences")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, preferences: payload });
}
