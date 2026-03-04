import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuth, requireHost } from "../_auth";

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

type ClaimRow = {
  id: string;
  bounty_id: string;
  user_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  resolved_at: string | null;
};

type CommentRow = {
  id: string;
  bounty_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

type ProfileRow = {
  user_id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
};

async function getProfileMap(
  admin: SupabaseClient,
  userIds: string[],
) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  const profileByUserId = new Map<string, ProfileRow>();
  if (!uniqueUserIds.length) {
    return profileByUserId;
  }

  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("user_id,handle,display_name,avatar_url")
    .in("user_id", uniqueUserIds);

  if (profileError) {
    throw new Error(profileError.message);
  }

  for (const profile of (profiles ?? []) as ProfileRow[]) {
    if (profile.user_id) {
      profileByUserId.set(profile.user_id, profile);
    }
  }
  return profileByUserId;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status ?? 401 });
  }

  const { id } = await context.params;

  const { data: bounty, error: bountyError } = await auth.admin
    .from("bounties")
    .select(
      "id, title, description, status, github_url, reward_type, reward_amount, reward_token, badge_id, created_by, created_at, updated_at, due_at, tags",
    )
    .eq("id", id)
    .maybeSingle();

  if (bountyError) {
    return Response.json({ error: bountyError.message }, { status: 500 });
  }

  if (!bounty) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const { data: activeClaim, error: activeClaimError } = await auth.admin
    .from("bounty_claims")
    .select("id, bounty_id, user_id, status, created_at, updated_at, submitted_at, resolved_at")
    .eq("bounty_id", id)
    .in("status", ["claimed", "submitted"])
    .maybeSingle();

  if (activeClaimError) {
    return Response.json({ error: activeClaimError.message }, { status: 500 });
  }

  const { data: comments, error: commentsError } = await auth.admin
    .from("bounty_comments")
    .select("id, bounty_id, user_id, body, created_at")
    .eq("bounty_id", id)
    .order("created_at", { ascending: true });

  if (commentsError) {
    return Response.json({ error: commentsError.message }, { status: 500 });
  }

  try {
    const profileByUserId = await getProfileMap(auth.admin, [
      (bounty as BountyRow).created_by,
      (activeClaim as ClaimRow | null)?.user_id ?? "",
      ...((comments ?? []) as CommentRow[]).map((comment) => comment.user_id),
    ]);

    return Response.json({
      bounty: {
        ...(bounty as BountyRow),
        author: profileByUserId.get((bounty as BountyRow).created_by) ?? null,
      },
      activeClaim: activeClaim
        ? {
            ...(activeClaim as ClaimRow),
            author: profileByUserId.get((activeClaim as ClaimRow).user_id) ?? null,
          }
        : null,
      comments: ((comments ?? []) as CommentRow[]).map((comment) => ({
        ...comment,
        author: profileByUserId.get(comment.user_id) ?? null,
      })),
    });
  } catch (profileError) {
    return Response.json(
      { error: profileError instanceof Error ? profileError.message : "Failed to resolve profiles." },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireHost(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status ?? 403 });
  }

  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const allowedBountyStatuses = new Set([
    "open",
    "claimed",
    "submitted",
    "accepted",
    "closed",
  ]);

  const patch: Record<string, unknown> = {};
  if (body?.title != null) patch.title = String(body.title).trim();
  if (body?.description != null) patch.description = String(body.description).trim();

  if (body?.status != null) {
    const status = String(body.status).trim();
    if (!allowedBountyStatuses.has(status)) {
      return Response.json({ error: `Invalid status: ${status}` }, { status: 400 });
    }
    patch.status = status;
  }

  if (body?.githubUrl != null) patch.github_url = String(body.githubUrl).trim() || null;
  if (body?.rewardType != null) patch.reward_type = String(body.rewardType).trim();
  if (body?.rewardAmount != null) {
    if (body.rewardAmount === "") {
      patch.reward_amount = null;
    } else {
      const n = Number(body.rewardAmount);
      patch.reward_amount = Number.isFinite(n) ? n : null;
    }
  }
  if (body?.rewardToken != null) patch.reward_token = String(body.rewardToken).trim() || null;
  if (body?.badgeId != null) patch.badge_id = String(body.badgeId).trim() || null;
  if (body?.dueAt != null) patch.due_at = body.dueAt ? String(body.dueAt) : null;
  if (body?.tags != null) patch.tags = Array.isArray(body.tags) ? body.tags : null;

  const { data, error } = await auth.admin
    .from("bounties")
    .update(patch)
    .eq("id", id)
    .select(
      "id, title, description, status, github_url, reward_type, reward_amount, reward_token, badge_id, created_by, created_at, updated_at, due_at, tags",
    )
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const profileByUserId = await getProfileMap(auth.admin, [(data as BountyRow).created_by]);
    return Response.json({
      bounty: {
        ...(data as BountyRow),
        author: profileByUserId.get((data as BountyRow).created_by) ?? null,
      },
    });
  } catch (profileError) {
    return Response.json(
      { error: profileError instanceof Error ? profileError.message : "Failed to resolve author." },
      { status: 500 },
    );
  }
}
