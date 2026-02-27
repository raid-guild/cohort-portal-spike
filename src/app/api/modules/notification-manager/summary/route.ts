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
};

type UntypedQuery = {
  select: (...args: unknown[]) => UntypedQuery;
  eq: (...args: unknown[]) => UntypedQuery;
  maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
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

function formatTopics(preferences: PreferenceRow): string {
  const enabled = [
    preferences.blog_enabled ? "blog" : null,
    preferences.forum_enabled ? "forum" : null,
    preferences.grimoire_enabled ? "grimoire" : null,
  ].filter((value): value is string => Boolean(value));

  return enabled.length ? enabled.join(", ") : "none";
}

export async function GET(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = asUntypedAdmin(supabaseAdminClient());
  const { data, error } = await admin
    .from("user_notification_preferences")
    .select("user_id,email_enabled,cadence,blog_enabled,forum_enabled,grimoire_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const preferences = (data as PreferenceRow | null) ?? defaultPreferences(userId);
  return Response.json({
    title: "Notifications",
    items: [
      { label: "Email", value: preferences.email_enabled ? "enabled" : "disabled" },
      { label: "Cadence", value: preferences.cadence },
      { label: "Topics", value: formatTopics(preferences) },
    ],
  });
}
