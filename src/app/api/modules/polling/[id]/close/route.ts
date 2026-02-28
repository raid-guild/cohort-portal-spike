import { NextRequest } from "next/server";
import { emitPortalEvent } from "@/lib/portal-events";
import { asUntypedAdmin, isHost, jsonError, requirePollViewer, type PollRow } from "../../lib";

export async function POST(
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
  if (!(poll.created_by === viewer.userId || isHost(viewer))) {
    return jsonError("Only poll creator or host can close polls.", 403);
  }
  if (poll.status === "closed") {
    return jsonError("Poll is already closed.", 409);
  }

  const { data: updatedData, error: updatedError } = await admin
    .from("polls")
    .update({ status: "closed" })
    .eq("id", poll.id)
    .select(
      "id,title,description,created_by,opens_at,closes_at,status,allow_vote_change,results_visibility,created_at,updated_at",
    )
    .single();

  if (updatedError || !updatedData) {
    return jsonError(updatedError?.message ?? "Failed to close poll.", 500);
  }

  const now = new Date().toISOString();
  try {
    await emitPortalEvent({
      moduleId: "polling",
      kind: "core.polling.poll_closed",
      authenticatedUserId: viewer.userId,
      actorId: viewer.userId,
      subject: {
        pollId: poll.id,
      },
      data: {
        closed_at: now,
      },
      dedupeKey: `polling_poll:${poll.id}:closed`,
    });
  } catch (error) {
    console.error("[polling] failed to emit poll_closed event", error);
  }

  return Response.json({ poll: updatedData });
}
