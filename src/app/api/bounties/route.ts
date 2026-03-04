import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuth, requireHost } from "./_auth";

type BountyRow = {
  id: string;
  title: string;
  description: string;
  status: string;
  github_url: string | null;
  reward_type: string;
  reward_amount: number | null;
  reward_token: string | null;
  badge_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  due_at: string | null;
  tags: string[] | null;
};

type ProfileRow = {
  user_id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
};

async function withBountyAuthors(
  admin: SupabaseClient,
  rows: BountyRow[],
) {
  const userIds = Array.from(new Set(rows.map((row) => row.created_by).filter(Boolean)));
  const profileByUserId = new Map<string, ProfileRow>();

  if (userIds.length) {
    const { data: profiles, error: profileError } = await admin
      .from("profiles")
      .select("user_id,handle,display_name,avatar_url")
      .in("user_id", userIds);

    if (profileError) {
      throw new Error(profileError.message);
    }

    for (const profile of (profiles ?? []) as ProfileRow[]) {
      if (profile.user_id) {
        profileByUserId.set(profile.user_id, profile);
      }
    }
  }

  return rows.map((row) => ({
    ...row,
    author: profileByUserId.get(row.created_by) ?? null,
  }));
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status ?? 401 });
  }

  const status = request.nextUrl.searchParams.get("status");
  const sort = request.nextUrl.searchParams.get("sort") ?? "updated";

  let query = auth.admin
    .from("bounties")
    .select(
      "id, title, description, status, github_url, reward_type, reward_amount, reward_token, badge_id, created_by, created_at, updated_at, due_at, tags",
    );

  if (status) {
    query = query.eq("status", status);
  }

  if (sort === "created") {
    query = query.order("created_at", { ascending: false });
  } else {
    query = query.order("updated_at", { ascending: false });
  }

  const { data, error } = await query;
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  try {
    const bounties = await withBountyAuthors(auth.admin, (data ?? []) as BountyRow[]);
    return Response.json({ bounties });
  } catch (profileError) {
    return Response.json(
      { error: profileError instanceof Error ? profileError.message : "Failed to resolve authors." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireHost(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status ?? 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const title = String(body?.title ?? "").trim();
  const description = String(body?.description ?? "").trim();
  const githubUrl = body?.githubUrl ? String(body.githubUrl).trim() : null;
  const rewardType = String(body?.rewardType ?? "none");
  const rewardAmount = body?.rewardAmount != null ? Number(body.rewardAmount) : null;
  const rewardToken = body?.rewardToken ? String(body.rewardToken).trim() : null;
  const badgeId = body?.badgeId ? String(body.badgeId).trim() : null;
  const dueAt = body?.dueAt ? String(body.dueAt) : null;
  const tags = Array.isArray(body?.tags) ? (body.tags as string[]) : null;

  if (!title) {
    return Response.json({ error: "Title is required." }, { status: 400 });
  }

  const { data, error } = await auth.admin
    .from("bounties")
    .insert({
      title,
      description,
      status: "open",
      github_url: githubUrl || null,
      reward_type: rewardType,
      reward_amount: Number.isFinite(rewardAmount as number) ? rewardAmount : null,
      reward_token: rewardToken,
      badge_id: badgeId,
      due_at: dueAt,
      tags,
      created_by: auth.userId,
    })
    .select(
      "id, title, description, status, github_url, reward_type, reward_amount, reward_token, badge_id, created_by, created_at, updated_at, due_at, tags",
    )
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  let bounty = data;
  try {
    const [enriched] = await withBountyAuthors(auth.admin, [data as BountyRow]);
    bounty = enriched ?? data;
  } catch (profileError) {
    console.error("[bounties] author enrichment failed:", profileError);
  }

  return Response.json({ bounty });
}
