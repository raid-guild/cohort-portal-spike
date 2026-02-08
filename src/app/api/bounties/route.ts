import { NextRequest } from "next/server";
import { requireAuth, requireHost } from "./_auth";

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

  return Response.json({ bounties: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireHost(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status ?? 403 });
  }

  const body = await request.json();
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

  return Response.json({ bounty: data });
}
