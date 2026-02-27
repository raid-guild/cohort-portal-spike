import { NextRequest } from "next/server";
import { isDuplicateSlugError, toSlug, validateSlugInput } from "@/lib/cohort-utils";
import type { Json } from "@/lib/types/db";
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

export async function GET(request: NextRequest) {
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

  const admin = supabaseAdminClient();
  const { data, error } = await admin
    .from("cohorts")
    .select("id, name, slug, status, start_at, end_at, theme_long, header_image_url")
    .order("start_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const cohorts = data ?? [];
  const active = cohorts.filter((cohort) => cohort.status === "active");
  const upcoming = cohorts
    .filter((cohort) => cohort.status === "upcoming" && cohort.start_at)
    .sort(
      (a, b) =>
        new Date(a.start_at ?? 0).getTime() - new Date(b.start_at ?? 0).getTime(),
    );
  const nextUpcoming = upcoming.length ? [upcoming[0]] : [];
  const archived = cohorts.filter((cohort) => cohort.status === "archived");

  return Response.json({
    cohorts: [...active, ...nextUpcoming, ...archived],
  });
}

export async function POST(request: NextRequest) {
  const result = await requireUser(request);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 401 });
  }
  if (!(await isHost(result.user.id))) {
    return Response.json({ error: "Host access required." }, { status: 403 });
  }

  const payload = (await request.json()) as {
    name: string;
    slug?: string | null;
    status?: string;
    startAt?: string | null;
    endAt?: string | null;
    themeLong?: string | null;
    headerImageUrl?: string | null;
    content?: {
      schedule?: unknown;
      projects?: unknown;
      resources?: unknown;
      notes?: unknown;
    };
  };

  if (!payload?.name) {
    return Response.json({ error: "Name is required." }, { status: 400 });
  }

  const providedSlug = payload.slug?.trim();
  if (providedSlug) {
    const slugError = validateSlugInput(providedSlug);
    if (slugError) {
      return Response.json({ error: slugError }, { status: 400 });
    }
  }

  const baseSlug = toSlug(providedSlug || payload.name);
  if (!baseSlug) {
    return Response.json(
      { error: "Name must include at least one letter or number." },
      { status: 400 },
    );
  }

  const admin = supabaseAdminClient();
  let cohort: { id: string } | null = null;
  let error: { code?: string; message?: string } | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const result = await admin
      .from("cohorts")
      .insert({
        name: payload.name,
        slug,
        status: payload.status ?? "upcoming",
        start_at: payload.startAt ?? null,
        end_at: payload.endAt ?? null,
        theme_long: payload.themeLong ?? null,
        header_image_url: payload.headerImageUrl ?? null,
      })
      .select("*")
      .single();
    cohort = result.data;
    error = result.error;
    if (!error) break;
    if (!isDuplicateSlugError(error) || Boolean(providedSlug)) break;
  }

  if (error || !cohort) {
    if (isDuplicateSlugError(error)) {
      return Response.json({ error: "Slug already exists." }, { status: 409 });
    }
    return Response.json(
      { error: error?.message ?? "Unable to create cohort." },
      { status: 500 },
    );
  }

  if (payload.content) {
    await admin.from("cohort_content").upsert({
      cohort_id: cohort.id,
      schedule: (payload.content.schedule ?? null) as Json | null,
      projects: (payload.content.projects ?? null) as Json | null,
      resources: (payload.content.resources ?? null) as Json | null,
      notes: (payload.content.notes ?? null) as Json | null,
    });
  }

  return Response.json({ cohort });
}
