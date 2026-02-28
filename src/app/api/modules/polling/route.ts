import { NextRequest } from "next/server";
import { emitPortalEvent } from "@/lib/portal-events";
import {
  asIsoDate,
  asUntypedAdmin,
  evaluateEligibility,
  jsonError,
  parseLimit,
  parseRule,
  requirePollViewer,
  stateForPoll,
  type PollResultsVisibility,
  type PollRow,
  type PollRule,
} from "./lib";

type CreatePollBody = {
  title?: unknown;
  description?: unknown;
  opens_at?: unknown;
  closes_at?: unknown;
  allow_vote_change?: unknown;
  results_visibility?: unknown;
  options?: unknown;
  eligibility_rules?: unknown;
};

function asTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function asVisibility(value: unknown): PollResultsVisibility {
  return value === "after_close" ? "after_close" : "live";
}

export async function GET(request: NextRequest) {
  const viewer = await requirePollViewer(request);
  if ("error" in viewer) {
    return jsonError(viewer.error, viewer.status);
  }

  const admin = asUntypedAdmin(viewer.admin);
  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get("limit"), 20, 50);
  const status = asTrimmed(url.searchParams.get("status"));
  const cursor = asIsoDate(url.searchParams.get("cursor"));

  let query = admin
    .from("polls")
    .select(
      "id,title,description,created_by,opens_at,closes_at,status,allow_vote_change,results_visibility,created_at,updated_at",
    )
    .order("opens_at", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.lt("opens_at", cursor);
  }

  const { data, error } = await query;
  if (error) {
    return jsonError(error.message, 500);
  }

  const polls = (data ?? []) as PollRow[];
  const page = polls.slice(0, limit);
  const hasNextPage = polls.length > limit;
  const pollIds = page.map((poll) => poll.id);

  if (!pollIds.length) {
    return Response.json({ items: [], nextCursor: null });
  }

  const [rulesRes, optionsRes, votesRes, myVotesRes] = await Promise.all([
    admin
      .from("poll_eligibility_rules")
      .select("id,poll_id,action,rule_type,rule_value")
      .in("poll_id", pollIds),
    admin
      .from("poll_options")
      .select("id,poll_id")
      .in("poll_id", pollIds),
    admin
      .from("poll_votes")
      .select("poll_id,option_id")
      .in("poll_id", pollIds),
    admin
      .from("poll_votes")
      .select("poll_id,option_id")
      .in("poll_id", pollIds)
      .eq("voter_user_id", viewer.userId),
  ]);

  if (rulesRes.error || optionsRes.error || votesRes.error || myVotesRes.error) {
    return jsonError(
      rulesRes.error?.message ||
        optionsRes.error?.message ||
        votesRes.error?.message ||
        myVotesRes.error?.message ||
        "Failed to load polls.",
      500,
    );
  }

  const rulesByPoll = new Map<string, PollRule[]>();
  for (const row of (rulesRes.data ?? []) as PollRule[]) {
    const bucket = rulesByPoll.get(row.poll_id ?? "") ?? [];
    bucket.push(row);
    if (row.poll_id) {
      rulesByPoll.set(row.poll_id, bucket);
    }
  }

  const optionsCountByPoll = new Map<string, number>();
  for (const row of (optionsRes.data ?? []) as Array<{ poll_id: string }>) {
    optionsCountByPoll.set(row.poll_id, (optionsCountByPoll.get(row.poll_id) ?? 0) + 1);
  }

  const votesCountByPoll = new Map<string, number>();
  for (const row of (votesRes.data ?? []) as Array<{ poll_id: string }>) {
    votesCountByPoll.set(row.poll_id, (votesCountByPoll.get(row.poll_id) ?? 0) + 1);
  }

  const myVoteByPoll = new Map<string, string>();
  for (const row of (myVotesRes.data ?? []) as Array<{ poll_id: string; option_id: string }>) {
    myVoteByPoll.set(row.poll_id, row.option_id);
  }

  const now = new Date();
  const items = page
    .map((poll) => {
      const rules = rulesByPoll.get(poll.id) ?? [];
      const state = stateForPoll(poll, now);
      const canVote = state === "open" && evaluateEligibility("vote", rules, viewer);
      const canViewResults =
        poll.results_visibility === "live" || state === "closed"
          ? evaluateEligibility("view_results", rules, viewer)
          : false;
      const canClose = poll.created_by === viewer.userId || viewer.roles.includes("host") || viewer.roles.includes("admin");
      return {
        id: poll.id,
        title: poll.title,
        description: poll.description,
        opens_at: poll.opens_at,
        closes_at: poll.closes_at,
        status: poll.status,
        state,
        allow_vote_change: poll.allow_vote_change,
        results_visibility: poll.results_visibility,
        options_count: optionsCountByPoll.get(poll.id) ?? 0,
        votes_count: votesCountByPoll.get(poll.id) ?? 0,
        viewer_vote_option_id: myVoteByPoll.get(poll.id) ?? null,
        viewer: {
          can_vote: canVote,
          can_view_results: canViewResults,
          can_close: canClose,
        },
      };
    })
    .filter((item) => {
      if (!status) return true;
      return status === item.state;
    })
    .filter((item) => item.viewer.can_vote || item.viewer.can_view_results || item.viewer.can_close);

  return Response.json({
    items,
    nextCursor: hasNextPage ? page[page.length - 1]?.opens_at ?? null : null,
  });
}

export async function POST(request: NextRequest) {
  const viewer = await requirePollViewer(request);
  if ("error" in viewer) {
    return jsonError(viewer.error, viewer.status);
  }

  let body: CreatePollBody;
  try {
    body = (await request.json()) as CreatePollBody;
  } catch {
    return jsonError("Invalid JSON.", 400);
  }

  const title = asTrimmed(body.title);
  if (!title) {
    return jsonError("title is required.", 400);
  }

  const opensAt = asIsoDate(body.opens_at);
  const closesAt = asIsoDate(body.closes_at);
  if (!opensAt || !closesAt) {
    return jsonError("opens_at and closes_at must be valid ISO datetimes.", 400);
  }

  if (new Date(closesAt) <= new Date(opensAt)) {
    return jsonError("closes_at must be later than opens_at.", 400);
  }

  const optionsInput = Array.isArray(body.options) ? body.options : [];
  const options = optionsInput
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as Record<string, unknown>;
      const label = asTrimmed(candidate.label);
      if (!label) return null;
      const subjectUserId = asTrimmed(candidate.subject_user_id);
      return {
        label,
        subject_user_id: subjectUserId,
        sort_order: index,
        metadata: {},
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (options.length < 2) {
    return jsonError("At least two options are required.", 400);
  }

  const parsedRules = (Array.isArray(body.eligibility_rules) ? body.eligibility_rules : [])
    .map((rule) => parseRule(rule))
    .filter((rule): rule is PollRule => Boolean(rule));

  const effectiveRules: PollRule[] = parsedRules.length
    ? parsedRules
    : [
        { action: "create", rule_type: "authenticated", rule_value: null },
        { action: "vote", rule_type: "authenticated", rule_value: null },
        { action: "view_results", rule_type: "authenticated", rule_value: null },
      ];

  const canCreate = evaluateEligibility("create", effectiveRules, viewer);
  if (!canCreate) {
    return jsonError("You are not eligible to create this poll.", 403);
  }

  const admin = asUntypedAdmin(viewer.admin);

  const { data: pollData, error: pollError } = await admin
    .from("polls")
    .insert({
      title,
      description: asTrimmed(body.description),
      created_by: viewer.userId,
      opens_at: opensAt,
      closes_at: closesAt,
      allow_vote_change: asBoolean(body.allow_vote_change, false),
      results_visibility: asVisibility(body.results_visibility),
      status: "open",
    })
    .select(
      "id,title,description,created_by,opens_at,closes_at,status,allow_vote_change,results_visibility,created_at,updated_at",
    )
    .single();

  if (pollError || !pollData) {
    return jsonError(pollError?.message ?? "Failed to create poll.", 500);
  }

  const poll = pollData as PollRow;
  const optionRows = options.map((option) => ({ ...option, poll_id: poll.id }));
  const ruleRows = effectiveRules.map((rule) => ({
    poll_id: poll.id,
    action: rule.action,
    rule_type: rule.rule_type,
    rule_value: rule.rule_value,
  }));

  const [optionsInsertRes, rulesInsertRes] = await Promise.all([
    admin.from("poll_options").insert(optionRows).select("id,poll_id,label,subject_user_id,sort_order,metadata,created_at"),
    admin
      .from("poll_eligibility_rules")
      .insert(ruleRows)
      .select("id,poll_id,action,rule_type,rule_value,created_at"),
  ]);

  if (optionsInsertRes.error || rulesInsertRes.error) {
    return jsonError(optionsInsertRes.error?.message || rulesInsertRes.error?.message || "Failed to create poll.", 500);
  }

  try {
    await emitPortalEvent({
      moduleId: "polling",
      kind: "core.polling.poll_created",
      authenticatedUserId: viewer.userId,
      actorId: viewer.userId,
      subject: { pollId: poll.id },
      data: {
        title: poll.title,
        opens_at: poll.opens_at,
        closes_at: poll.closes_at,
      },
      dedupeKey: `polling_poll:${poll.id}:created`,
    });
  } catch (error) {
    console.error("[polling] failed to emit poll_created event", error);
  }

  return Response.json(
    {
      poll,
      options: optionsInsertRes.data ?? [],
      eligibility_rules: rulesInsertRes.data ?? [],
    },
    { status: 201 },
  );
}
