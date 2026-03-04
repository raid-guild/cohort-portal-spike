import { NextRequest } from "next/server";
import {
  TASK_STATUSES,
  accountExists,
  asNullableTimestamp,
  asString,
  includesValue,
  isUuid,
  jsonError,
  loadCrmProfileMap,
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
  if (!isUuid(accountId)) {
    return jsonError("Invalid account id.", 400);
  }
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  const title = asString(payload?.title);
  const dueAt = asNullableTimestamp(payload?.dueAt);
  const assigneeProvided = Object.prototype.hasOwnProperty.call(payload ?? {}, "assigneeUserId");
  const statusProvided = Object.prototype.hasOwnProperty.call(payload ?? {}, "status");

  let assigneeUserId = viewer.userId;
  if (assigneeProvided) {
    const parsedAssigneeUserId = asString(payload?.assigneeUserId);
    if (!parsedAssigneeUserId) {
      return jsonError("assigneeUserId is invalid.", 400);
    }
    assigneeUserId = parsedAssigneeUserId;
  }

  let status: (typeof TASK_STATUSES)[number] = "open";
  if (statusProvided) {
    const parsedStatus = asString(payload?.status);
    if (!parsedStatus || !includesValue(parsedStatus, TASK_STATUSES)) {
      return jsonError("status is invalid.", 400);
    }
    status = parsedStatus;
  }

  if (!title) {
    return jsonError("title is required.", 400);
  }

  let exists = false;
  try {
    exists = await accountExists(viewer.admin, accountId);
  } catch {
    return jsonError("Account not found.", 404);
  }
  if (!exists) {
    return jsonError("Account not found.", 404);
  }

  const admin = viewer.admin;
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

  let assignee = null;
  let author = null;
  try {
    const profileByUserId = await loadCrmProfileMap(admin, [
      data.assignee_user_id ?? "",
      data.created_by,
    ]);
    assignee = data.assignee_user_id ? profileByUserId.get(data.assignee_user_id) ?? null : null;
    author = profileByUserId.get(data.created_by) ?? null;
  } catch (profileError) {
    console.error("[relationship-crm] task profile enrichment failed:", profileError);
  }

  return Response.json(
    {
      task: {
        ...data,
        assignee,
        author,
      },
    },
    { status: 201 },
  );
}
