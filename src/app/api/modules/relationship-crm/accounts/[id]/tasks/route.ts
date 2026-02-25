import { NextRequest } from "next/server";
import {
  TASK_STATUSES,
  accountExists,
  asNullableTimestamp,
  asString,
  asUntypedAdmin,
  includesValue,
  jsonError,
  requireCrmAccess,
} from "@/app/api/modules/relationship-crm/lib";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const viewer = await requireCrmAccess(request);
  if ("error" in viewer) {
    return jsonError(viewer.error, viewer.status);
  }

  const { id: accountId } = await context.params;
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  const title = asString(payload?.title);
  const assigneeUserId = asString(payload?.assigneeUserId) ?? viewer.userId;
  const dueAt = asNullableTimestamp(payload?.dueAt);
  const status = asString(payload?.status) ?? "open";

  if (!title) {
    return jsonError("title is required.", 400);
  }
  if (!includesValue(status, TASK_STATUSES)) {
    return jsonError("status is invalid.", 400);
  }

  const exists = await accountExists(viewer.admin, accountId);
  if (!exists) {
    return jsonError("Account not found.", 404);
  }

  const admin = asUntypedAdmin(viewer.admin);
  const { data, error } = await admin
    .from("relationship_crm_tasks")
    .insert({
      account_id: accountId,
      assignee_user_id: assigneeUserId,
      title,
      due_at: dueAt,
      status,
      created_by: viewer.userId,
      completed_at: status === "done" ? new Date().toISOString() : null,
    })
    .select("id,account_id,assignee_user_id,title,due_at,status,created_by,completed_at,created_at,updated_at")
    .single();

  if (error) {
    return jsonError(`Failed to add task: ${error.message}`, 500);
  }

  return Response.json({ task: data }, { status: 201 });
}
