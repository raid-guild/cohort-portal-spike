import { NextRequest } from "next/server";
import { requireAuth, requireHost } from "../_auth";

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

  const { data: activeClaim } = await auth.admin
    .from("bounty_claims")
    .select("id, bounty_id, user_id, status, created_at, updated_at, submitted_at, resolved_at")
    .eq("bounty_id", id)
    .in("status", ["claimed", "submitted"])
    .maybeSingle();

  const { data: comments } = await auth.admin
    .from("bounty_comments")
    .select("id, bounty_id, user_id, body, created_at")
    .eq("bounty_id", id)
    .order("created_at", { ascending: true });

  return Response.json({ bounty, activeClaim: activeClaim ?? null, comments: comments ?? [] });
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
  const body = await request.json();

  const patch: Record<string, unknown> = {};
  if (body?.title != null) patch.title = String(body.title).trim();
  if (body?.description != null) patch.description = String(body.description).trim();
  if (body?.status != null) patch.status = String(body.status).trim();
  if (body?.githubUrl != null) patch.github_url = String(body.githubUrl).trim() || null;
  if (body?.rewardType != null) patch.reward_type = String(body.rewardType).trim();
  if (body?.rewardAmount != null)
    patch.reward_amount = body.rewardAmount === "" ? null : Number(body.rewardAmount);
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

  return Response.json({ bounty: data });
}
