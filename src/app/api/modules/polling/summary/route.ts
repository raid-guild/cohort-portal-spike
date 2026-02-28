import { NextRequest } from "next/server";
import { asUntypedAdmin, evaluateEligibility, jsonError, requirePollViewer, stateForPoll, type PollRow, type PollRule } from "../lib";

export async function GET(request: NextRequest) {
  const viewer = await requirePollViewer(request);
  if ("error" in viewer) {
    return jsonError(viewer.error, viewer.status);
  }

  const admin = asUntypedAdmin(viewer.admin);
  const now = new Date();
  const closingSoonCutoff = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

  const [pollsRes, rulesRes, votesRes] = await Promise.all([
    admin
      .from("polls")
      .select(
        "id,title,description,created_by,opens_at,closes_at,status,allow_vote_change,results_visibility,created_at,updated_at",
      )
      .neq("status", "draft")
      .order("opens_at", { ascending: false })
      .limit(200),
    admin
      .from("poll_eligibility_rules")
      .select("id,poll_id,action,rule_type,rule_value")
      .limit(1000),
    admin
      .from("poll_votes")
      .select("poll_id")
      .eq("voter_user_id", viewer.userId),
  ]);

  if (pollsRes.error || rulesRes.error || votesRes.error) {
    return jsonError(
      pollsRes.error?.message || rulesRes.error?.message || votesRes.error?.message || "Failed to load summary.",
      500,
    );
  }

  const polls = (pollsRes.data ?? []) as PollRow[];
  const rules = (rulesRes.data ?? []) as PollRule[];

  const rulesByPoll = new Map<string, PollRule[]>();
  for (const rule of rules) {
    const key = rule.poll_id ?? "";
    if (!key) continue;
    const bucket = rulesByPoll.get(key) ?? [];
    bucket.push(rule);
    rulesByPoll.set(key, bucket);
  }

  let openPolls = 0;
  let closingSoon = 0;

  for (const poll of polls) {
    const pollRules = rulesByPoll.get(poll.id) ?? [];
    if (!evaluateEligibility("vote", pollRules, viewer)) {
      continue;
    }

    const state = stateForPoll(poll, now);
    if (state === "open") {
      openPolls += 1;
      if (poll.closes_at <= closingSoonCutoff) {
        closingSoon += 1;
      }
    }
  }

  const participated = new Set((votesRes.data ?? []).map((row: { poll_id: string }) => row.poll_id)).size;

  return Response.json({
    title: "Polling",
    layout: "compact",
    items: [
      { label: "Open polls", value: String(openPolls) },
      { label: "Closing soon", value: String(closingSoon) },
      { label: "Participated", value: String(participated) },
    ],
  });
}
