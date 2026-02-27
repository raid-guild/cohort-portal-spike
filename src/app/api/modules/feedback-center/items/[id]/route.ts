import { NextRequest } from "next/server";
import { requireFeedbackAuth } from "../../_auth";
import {
  type FeedbackHostPatchInput,
  type FeedbackItem,
  type FeedbackReporterPatchInput,
  type FeedbackType,
  validateHostPatch,
  validateReporterPatch,
} from "../../lib";

const ITEM_SELECT =
  "id,type,title,description_md,steps_to_reproduce_md,expected_result_md,actual_result_md,problem_md,proposed_outcome_md,status,priority,module_id,route_path,reporter_user_id,assignee_user_id,triage_notes,browser_meta,created_at,updated_at,closed_at";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireFeedbackAuth(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  const { data: existing, error: existingError } = await auth.admin
    .from("feedback_items")
    .select("id,type,status,reporter_user_id")
    .eq("id", id)
    .maybeSingle();

  if (existingError) {
    return Response.json({ error: existingError.message }, { status: 500 });
  }
  if (!existing) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  let body: FeedbackReporterPatchInput & FeedbackHostPatchInput;
  try {
    body = (await request.json()) as FeedbackReporterPatchInput & FeedbackHostPatchInput;
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const isReporter = existing.reporter_user_id === auth.userId;
  const reporterCanEdit = isReporter && existing.status === "new";

  if (!auth.isHost && !reporterCanEdit) {
    return Response.json(
      { error: "Only hosts/admins or the original reporter (while status=new) can edit this item." },
      { status: 403 },
    );
  }

  const updateResult = auth.isHost
    ? validateHostPatch(body)
    : validateReporterPatch(body, existing.type as FeedbackType);

  if (!updateResult.value) {
    return Response.json({ error: updateResult.error ?? "Invalid payload." }, { status: 400 });
  }

  if (Object.keys(updateResult.value).length === 0) {
    return Response.json({ error: "No updatable fields provided." }, { status: 400 });
  }

  let updateQuery = auth.admin
    .from("feedback_items")
    .update(updateResult.value)
    .eq("id", id);

  if (!auth.isHost) {
    updateQuery = updateQuery.eq("reporter_user_id", auth.userId).eq("status", "new");
  }

  const { data, error } = await updateQuery.select(ITEM_SELECT).maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return Response.json(
      { error: auth.isHost ? "Not found." : "Item can no longer be edited." },
      { status: auth.isHost ? 404 : 409 },
    );
  }

  return Response.json({ item: data as FeedbackItem });
}
