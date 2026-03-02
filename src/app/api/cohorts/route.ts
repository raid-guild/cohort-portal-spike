import { NextRequest } from "next/server";
import type { Json } from "@/lib/types/db";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import {
  isHost,
  parseParticipants,
  parsePartners,
  requireUser,
  syncCohortRelationships,
  toSlug,
} from "./lib";

export async function GET(request: NextRequest) {
  const result = await requireUser(request);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 401 });
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
  let host = false;
  try {
    host = await isHost(result.user.id);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unable to verify host access." },
      { status: 500 },
    );
  }
  if (!host) {
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
    participants?: unknown;
    partners?: unknown;
  };

  if (!payload?.name) {
    return Response.json({ error: "Name is required." }, { status: 400 });
  }

  const admin = supabaseAdminClient();
  const { data: cohort, error } = await admin
    .from("cohorts")
    .insert({
      name: payload.name,
      slug: toSlug(payload.slug?.trim() || payload.name),
      status: payload.status ?? "upcoming",
      start_at: payload.startAt ?? null,
      end_at: payload.endAt ?? null,
      theme_long: payload.themeLong ?? null,
      header_image_url: payload.headerImageUrl ?? null,
    })
    .select("*")
    .single();

  if (error || !cohort) {
    if (
      error?.message.toLowerCase().includes("duplicate") ||
      error?.message.includes("cohorts_slug_unique_idx")
    ) {
      return Response.json({ error: "Slug already exists." }, { status: 409 });
    }
    return Response.json(
      { error: error?.message ?? "Unable to create cohort." },
      { status: 500 },
    );
  }

  if (payload.content) {
    const { error: contentError } = await admin.from("cohort_content").upsert({
      cohort_id: cohort.id,
      schedule: (payload.content.schedule ?? null) as Json | null,
      projects: (payload.content.projects ?? null) as Json | null,
      resources: (payload.content.resources ?? null) as Json | null,
      notes: (payload.content.notes ?? null) as Json | null,
    });
    if (contentError) {
      await admin.from("cohorts").delete().eq("id", cohort.id);
      return Response.json(
        { error: `Unable to save cohort content: ${contentError.message}` },
        { status: 500 },
      );
    }
  }

  const participants = parseParticipants(payload.participants);
  const partners = parsePartners(payload.partners);

  try {
    await syncCohortRelationships({
      cohortId: cohort.id,
      participants,
      partners,
      syncParticipants: true,
      syncPartners: true,
    });
  } catch (err) {
    await admin.from("cohorts").delete().eq("id", cohort.id);
    return Response.json(
      { error: err instanceof Error ? err.message : "Unable to save cohort relationships." },
      { status: 400 },
    );
  }

  return Response.json({ cohort });
}
