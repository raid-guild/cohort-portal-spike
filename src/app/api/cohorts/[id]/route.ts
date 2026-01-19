import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";

const requireUser = async (request: NextRequest) => {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Missing auth token." } as const;
  }
  const token = authHeader.replace("Bearer ", "");
  const supabase = supabaseServerClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { error: "Invalid auth token." } as const;
  }
  return { user: data.user } as const;
};

const isHost = async (userId: string) => {
  const admin = supabaseAdminClient();
  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "host")
    .maybeSingle();
  return Boolean(data);
};

const hasCohortAccess = async (userId: string) => {
  const admin = supabaseAdminClient();
  const now = new Date().toISOString();
  const { data } = await admin
    .from("entitlements")
    .select("entitlement")
    .eq("user_id", userId)
    .eq("entitlement", "cohort-access")
    .eq("status", "active")
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .maybeSingle();
  return Boolean(data);
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await requireUser(request);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 401 });
  }

  const [host, access] = await Promise.all([
    isHost(result.user.id),
    hasCohortAccess(result.user.id),
  ]);
  if (!host && !access) {
    return Response.json({ error: "Access required." }, { status: 403 });
  }

  const { id } = await context.params;
  const admin = supabaseAdminClient();
  const { data: cohort, error } = await admin
    .from("cohorts")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !cohort) {
    return Response.json({ error: "Cohort not found." }, { status: 404 });
  }

  const { data: content } = await admin
    .from("cohort_content")
    .select("schedule, projects, resources, notes")
    .eq("cohort_id", id)
    .maybeSingle();

  return Response.json({ cohort, content: content ?? null });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await requireUser(request);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 401 });
  }
  if (!(await isHost(result.user.id))) {
    return Response.json({ error: "Host access required." }, { status: 403 });
  }

  const { id } = await context.params;
  const payload = (await request.json()) as {
    name?: string;
    status?: string;
    startAt?: string | null;
    endAt?: string | null;
    content?: {
      schedule?: unknown;
      projects?: unknown;
      resources?: unknown;
      notes?: unknown;
    };
  };

  const admin = supabaseAdminClient();
  const { data: cohort, error } = await admin
    .from("cohorts")
    .update({
      ...(payload.name ? { name: payload.name } : {}),
      ...(payload.status ? { status: payload.status } : {}),
      ...(payload.startAt !== undefined ? { start_at: payload.startAt } : {}),
      ...(payload.endAt !== undefined ? { end_at: payload.endAt } : {}),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !cohort) {
    return Response.json({ error: "Unable to update cohort." }, { status: 500 });
  }

  if (payload.content) {
    await admin.from("cohort_content").upsert({
      cohort_id: id,
      schedule: payload.content.schedule ?? null,
      projects: payload.content.projects ?? null,
      resources: payload.content.resources ?? null,
      notes: payload.content.notes ?? null,
    });
  }

  return Response.json({ cohort });
}
