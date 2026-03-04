import { NextRequest } from "next/server";
import {
  TASK_STATUSES,
  asNullableTimestamp,
  asString,
  includesValue,
  isUuid,
  jsonError,
  loadCrmProfileMap,
  requireCrmAccess,
} from "@/app/api/modules/relationship-crm/lib";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const viewer = await requireCrmAccess(request);
  if ("error" in viewer) {
    return jsonError(viewer.error, viewer.status);
  }

  const { id } = await context.params;
  if (!isUuid(id)) {
    return jsonError("Invalid task id.", 400);
  }
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  const updates: Record<string, unknown> = {};

  const title = asString(payload?.title);
  const status = asString(payload?.status);

  if (title) {
    updates.title = title;
  }
  if (Object.prototype.hasOwnProperty.call(payload ?? {}, "assigneeUserId")) {
    const assigneeUserId = asString(payload?.assigneeUserId);
    if (!assigneeUserId) {
      return jsonError("assigneeUserId is invalid.", 400);
    }
    updates.assignee_user_id = assigneeUserId;
  }
  if (Object.prototype.hasOwnProperty.call(payload ?? {}, "dueAt")) {
    const rawDueAt = payload?.dueAt;
    const dueAt = asNullableTimestamp(rawDueAt);
    if (rawDueAt !== null && rawDueAt !== undefined && dueAt === null) {
      return jsonError("dueAt is invalid.", 400);
    }
    updates.due_at = dueAt;
  }
  if (status !== null) {
    if (!includesValue(status, TASK_STATUSES)) {
      return jsonError("status is invalid.", 400);
    }
    updates.status = status;
    updates.completed_at = status === "done" ? new Date().toISOString() : null;
  }

  if (!Object.keys(updates).length) {
    return jsonError("No valid fields provided.", 400);
  }

  const admin = viewer.admin;
  const { data, error } = await admin
    .from("relationship_crm_tasks")
    .update(updates)
    .eq("id", id)
    .select("id,account_id,assignee_user_id,title,due_at,status,created_by,completed_at,created_at,updated_at")
    .maybeSingle();

  if (error) {
    return jsonError(`Failed to update task: ${error.message}`, 500);
  }
  if (!data) {
    return jsonError("Task not found.", 404);
  }

  try {
    const profileByUserId = await loadCrmProfileMap(admin, [
      data.assignee_user_id ?? "",
      data.created_by,
    ]);
    return Response.json({
      task: {
        ...data,
        assignee: data.assignee_user_id ? profileByUserId.get(data.assignee_user_id) ?? null : null,
        author: profileByUserId.get(data.created_by) ?? null,
      },
    });
  } catch (profileError) {
    return jsonError(
      `Failed to resolve task profiles: ${
        profileError instanceof Error ? profileError.message : "Unknown error"
      }`,
      500,
    );
  }
}
