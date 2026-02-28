import { NextRequest } from "next/server";
import { emitPortalEvent } from "@/lib/portal-events";
import {
  asUntypedAdmin,
  evaluateEligibility,
  jsonError,
  requirePollViewer,
  stateForPoll,
  type PollRow,
  type PollRule,
} from "../../lib";

type VoteBody = {
  option_id?: unknown;
};

function asTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await requirePollViewer(request);
  if ("error" in viewer) {
    return jsonError(viewer.error, viewer.status);
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON.", 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("Invalid JSON.", 400);
  }

  const optionId = asTrimmed((body as VoteBody).option_id);
  if (!optionId) {
    return jsonError("option_id is required.", 400);
  }

  const admin = asUntypedAdmin(viewer.admin);
  const [pollRes, rulesRes, optionRes, existingVoteRes] = await Promise.all([
    admin
      .from("polls")
      .select(
        "id,title,description,created_by,opens_at,closes_at,status,allow_vote_change,results_visibility,created_at,updated_at",
      )
      .eq("id", id)
      .maybeSingle(),
    admin
      .from("poll_eligibility_rules")
      .select("id,poll_id,action,rule_type,rule_value")
      .eq("poll_id", id),
    admin
      .from("poll_options")
      .select("id,poll_id")
      .eq("id", optionId)
      .eq("poll_id", id)
      .maybeSingle(),
    admin
      .from("poll_votes")
      .select("id,poll_id,option_id,voter_user_id,created_at,updated_at")
      .eq("poll_id", id)
      .eq("voter_user_id", viewer.userId)
      .maybeSingle(),
  ]);

  if (pollRes.error || rulesRes.error || optionRes.error || existingVoteRes.error) {
    return jsonError(
      pollRes.error?.message ||
        rulesRes.error?.message ||
        optionRes.error?.message ||
        existingVoteRes.error?.message ||
        "Failed to cast vote.",
      500,
    );
  }

  if (!pollRes.data) {
    return jsonError("Poll not found.", 404);
  }
  if (!optionRes.data) {
    return jsonError("Option not found for poll.", 404);
  }

  const poll = pollRes.data as PollRow;
  const rules = (rulesRes.data ?? []) as PollRule[];
  const state = stateForPoll(poll, new Date());

  if (state !== "open") {
    return jsonError("Poll is not open for voting.", 409);
  }

  if (!evaluateEligibility("vote", rules, viewer)) {
    return jsonError("You are not eligible to vote in this poll.", 403);
  }

  const existingVote = (existingVoteRes.data as {
    id: string;
    poll_id: string;
    option_id: string;
    voter_user_id: string;
    created_at: string;
    updated_at: string;
  } | null) ?? null;

  type VoteRecord = {
    id: string;
    poll_id: string;
    option_id: string;
    voter_user_id: string;
    created_at: string;
    updated_at: string;
  };

  let voteRecord: VoteRecord | null = null;
  let changed = false;

  if (existingVote) {
    if (!poll.allow_vote_change) {
      return jsonError("Vote already exists and vote changes are disabled.", 409);
    }
    if (existingVote.option_id === optionId) {
      return Response.json({ vote: existingVote, changed: false });
    }

    const { data, error } = await admin
      .from("poll_votes")
      .update({ option_id: optionId, updated_at: new Date().toISOString() })
      .eq("id", existingVote.id)
      .select("id,poll_id,option_id,voter_user_id,created_at,updated_at")
      .single();

    if (error || !data) {
      if ((error as { code?: string } | null)?.code === "23514") {
        return jsonError("Poll is not open for voting.", 409);
      }
      return jsonError(error?.message ?? "Failed to update vote.", 500);
    }

    voteRecord = data as VoteRecord;
    changed = true;
  } else {
    const { data, error } = await admin
      .from("poll_votes")
      .insert({ poll_id: poll.id, option_id: optionId, voter_user_id: viewer.userId })
      .select("id,poll_id,option_id,voter_user_id,created_at,updated_at")
      .single();

    if (error || !data) {
      if ((error as { code?: string } | null)?.code === "23505") {
        return jsonError("Vote already exists.", 409);
      }
      if ((error as { code?: string } | null)?.code === "23514") {
        return jsonError("Poll is not open for voting.", 409);
      }
      return jsonError(error?.message ?? "Failed to cast vote.", 500);
    }

    voteRecord = data as VoteRecord;
  }

  try {
    await emitPortalEvent({
      moduleId: "polling",
      kind: "core.polling.vote_cast",
      authenticatedUserId: viewer.userId,
      actorId: viewer.userId,
      subject: {
        pollId: poll.id,
        optionId,
      },
      data: {
        vote_id: voteRecord.id,
        changed,
      },
      dedupeKey: `polling_vote:${voteRecord.id}:${voteRecord.updated_at}`,
    });
  } catch (error) {
    console.error("[polling] failed to emit vote_cast event", error);
  }

  return Response.json({ vote: voteRecord, changed });
}
