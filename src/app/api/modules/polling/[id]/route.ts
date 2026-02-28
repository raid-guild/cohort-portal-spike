import { NextRequest } from "next/server";
import {
  asUntypedAdmin,
  evaluateEligibility,
  jsonError,
  requirePollViewer,
  stateForPoll,
  summarizePollCounts,
  type PollRow,
  type PollRule,
} from "../lib";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await requirePollViewer(request);
  if ("error" in viewer) {
    return jsonError(viewer.error, viewer.status);
  }

  const { id } = await params;
  const admin = asUntypedAdmin(viewer.admin);

  const { data: pollData, error: pollError } = await admin
    .from("polls")
    .select(
      "id,title,description,created_by,opens_at,closes_at,status,allow_vote_change,results_visibility,created_at,updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (pollError) {
    return jsonError(pollError.message, 500);
  }
  if (!pollData) {
    return jsonError("Poll not found.", 404);
  }

  const poll = pollData as PollRow;

  const [rulesRes, optionsRes, votesRes, myVoteRes] = await Promise.all([
    admin
      .from("poll_eligibility_rules")
      .select("id,poll_id,action,rule_type,rule_value")
      .eq("poll_id", poll.id),
    admin
      .from("poll_options")
      .select("id,poll_id,label,subject_user_id,sort_order,metadata,created_at")
      .eq("poll_id", poll.id)
      .order("sort_order", { ascending: true }),
    admin
      .from("poll_votes")
      .select("id,poll_id,option_id,voter_user_id,created_at,updated_at")
      .eq("poll_id", poll.id),
    admin
      .from("poll_votes")
      .select("id,poll_id,option_id,voter_user_id,created_at,updated_at")
      .eq("poll_id", poll.id)
      .eq("voter_user_id", viewer.userId)
      .maybeSingle(),
  ]);

  if (rulesRes.error || optionsRes.error || votesRes.error || myVoteRes.error) {
    return jsonError(
      rulesRes.error?.message ||
        optionsRes.error?.message ||
        votesRes.error?.message ||
        myVoteRes.error?.message ||
        "Failed to load poll details.",
      500,
    );
  }

  const rules = (rulesRes.data ?? []) as PollRule[];
  const options =
    ((optionsRes.data ?? []) as Array<{
      id: string;
      poll_id: string;
      label: string;
      subject_user_id: string | null;
      sort_order: number;
      metadata: Record<string, unknown> | null;
      created_at: string;
    }>) ?? [];
  const votes =
    ((votesRes.data ?? []) as Array<{
      id: string;
      poll_id: string;
      option_id: string;
      voter_user_id: string;
      created_at: string;
      updated_at: string;
    }>) ?? [];
  const myVote =
    (myVoteRes.data as {
      id: string;
      poll_id: string;
      option_id: string;
      voter_user_id: string;
      created_at: string;
      updated_at: string;
    } | null) ?? null;

  const now = new Date();
  const state = stateForPoll(poll, now);
  const canVote = state === "open" && evaluateEligibility("vote", rules, viewer);
  const canViewByRule = evaluateEligibility("view_results", rules, viewer);
  const canSeeResults = canViewByRule && (poll.results_visibility === "live" || state === "closed");
  const canClose = poll.created_by === viewer.userId || viewer.roles.includes("host") || viewer.roles.includes("admin");

  if (!canVote && !canViewByRule && !canClose) {
    return jsonError("You are not eligible to view this poll.", 403);
  }

  const counts = summarizePollCounts(options, votes);

  return Response.json({
    poll: {
      ...poll,
      state,
      results_visible: canSeeResults,
      viewer: {
        can_vote: canVote,
        can_view_results: canViewByRule,
        can_close: canClose,
      },
      totals: {
        total_votes: canSeeResults ? votes.length : null,
      },
    },
    options: options.map((option) => ({
      ...option,
      votes_count: canSeeResults ? counts.get(option.id) ?? 0 : null,
    })),
    eligibility_rules: rules,
    viewer_vote: myVote,
  });
}
