import { NextRequest } from "next/server";
import type { Json } from "@/lib/types/db";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import {
  hasCohortAccess,
  isHost,
  loadCohortParticipants,
  loadCohortPartners,
  parseParticipants,
  parsePartners,
  requireUser,
  syncCohortParticipants,
  syncCohortPartners,
  toSlug,
} from "../lib";

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

  try {
    const [{ data: content }, participants, partners] = await Promise.all([
      admin
        .from("cohort_content")
        .select("schedule, projects, resources, notes")
        .eq("cohort_id", id)
        .maybeSingle(),
      loadCohortParticipants(id),
      loadCohortPartners(id),
    ]);

    return Response.json({
      cohort,
      content: content ?? null,
      participants,
      partners,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unable to load cohort details." },
      { status: 500 },
    );
  }
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
    participants?: unknown;
    partners?: unknown;
  };

  const admin = supabaseAdminClient();
  const { data: cohort, error } = await admin
    .from("cohorts")
    .update({
      ...(payload.name ? { name: payload.name } : {}),
      ...(payload.slug !== undefined
        ? { slug: payload.slug ? toSlug(payload.slug) : null }
        : {}),
      ...(payload.status ? { status: payload.status } : {}),
      ...(payload.startAt !== undefined ? { start_at: payload.startAt } : {}),
      ...(payload.endAt !== undefined ? { end_at: payload.endAt } : {}),
      ...(payload.themeLong !== undefined ? { theme_long: payload.themeLong } : {}),
      ...(payload.headerImageUrl !== undefined
        ? { header_image_url: payload.headerImageUrl }
        : {}),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !cohort) {
    if (
      error?.message.toLowerCase().includes("duplicate") ||
      error?.message.includes("cohorts_slug_unique_idx")
    ) {
      return Response.json({ error: "Slug already exists." }, { status: 409 });
    }
    return Response.json({ error: "Unable to update cohort." }, { status: 500 });
  }

  if (payload.content) {
    const contentRow = {
      cohort_id: id,
      schedule: (payload.content.schedule ?? null) as Json | null,
      projects: (payload.content.projects ?? null) as Json | null,
      resources: (payload.content.resources ?? null) as Json | null,
      notes: (payload.content.notes ?? null) as Json | null,
    };
    await admin.from("cohort_content").upsert(contentRow);
  }

  try {
    if (Object.prototype.hasOwnProperty.call(payload ?? {}, "participants")) {
      await syncCohortParticipants(id, parseParticipants(payload.participants));
    }
    if (Object.prototype.hasOwnProperty.call(payload ?? {}, "partners")) {
      await syncCohortPartners(id, parsePartners(payload.partners));
    }
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unable to save cohort relationships." },
      { status: 400 },
    );
  }

  return Response.json({ cohort });
}
