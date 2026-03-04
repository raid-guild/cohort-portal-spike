import { NextRequest } from "next/server";
import {
  ACCOUNT_STAGES,
  ACCOUNT_STATUSES,
  RELATIONSHIP_TYPES,
  asNullableTimestamp,
  asString,
  includesValue,
  jsonError,
  loadCrmProfileMap,
  requireCrmAccess,
} from "@/app/api/modules/relationship-crm/lib";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const viewer = await requireCrmAccess(request);
  if ("error" in viewer) {
    return jsonError(viewer.error, viewer.status);
  }

  const { id } = await context.params;
  const admin = viewer.admin;

  const [accountRes, contactsRes, interactionsRes, tasksRes] = await Promise.all([
    admin
      .from("relationship_crm_accounts")
      .select("id,name,relationship_type,stage,status,owner_user_id,next_follow_up_at,notes,created_by,created_at,updated_at")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    admin
      .from("relationship_crm_contacts")
      .select("id,account_id,full_name,role_title,email,phone,preferred_channel,is_primary,created_at,updated_at")
      .eq("account_id", id)
      .order("is_primary", { ascending: false })
      .order("full_name", { ascending: true }),
    admin
      .from("relationship_crm_interactions")
      .select("id,account_id,contact_id,interaction_type,summary,interaction_at,created_by,created_at")
      .eq("account_id", id)
      .order("interaction_at", { ascending: false })
      .limit(50),
    admin
      .from("relationship_crm_tasks")
      .select("id,account_id,assignee_user_id,title,due_at,status,created_by,completed_at,created_at,updated_at")
      .eq("account_id", id)
      .eq("status", "open")
      .order("status", { ascending: true })
      .order("due_at", { ascending: true, nullsFirst: false }),
  ]);

  if (accountRes.error) {
    return jsonError(`Failed to load account: ${accountRes.error.message}`, 500);
  }
  if (!accountRes.data) {
    return jsonError("Account not found.", 404);
  }

  if (contactsRes.error || interactionsRes.error || tasksRes.error) {
    const error = contactsRes.error ?? interactionsRes.error ?? tasksRes.error;
    return jsonError(`Failed to load account detail: ${error?.message ?? "Unknown error"}`, 500);
  }

  try {
    const account = accountRes.data;
    const interactions = interactionsRes.data ?? [];
    const tasks = tasksRes.data ?? [];
    const profileByUserId = await loadCrmProfileMap(admin, [
      account.owner_user_id,
      ...interactions.map((interaction) => interaction.created_by),
      ...tasks.flatMap((task) => [task.assignee_user_id ?? "", task.created_by]),
    ]);

    return Response.json({
      account: {
        ...account,
        owner: profileByUserId.get(account.owner_user_id) ?? null,
      },
      contacts: contactsRes.data ?? [],
      interactions: interactions.map((interaction) => ({
        ...interaction,
        author: profileByUserId.get(interaction.created_by) ?? null,
      })),
      tasks: tasks.map((task) => ({
        ...task,
        assignee: task.assignee_user_id ? profileByUserId.get(task.assignee_user_id) ?? null : null,
        author: profileByUserId.get(task.created_by) ?? null,
      })),
    });
  } catch (profileError) {
    return jsonError(
      `Failed to resolve profile identities: ${
        profileError instanceof Error ? profileError.message : "Unknown error"
      }`,
      500,
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const viewer = await requireCrmAccess(request);
  if ("error" in viewer) {
    return jsonError(viewer.error, viewer.status);
  }

  const { id } = await context.params;
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  const updates: Record<string, unknown> = {};

  const name = asString(payload?.name);
  const relationshipType = asString(payload?.relationshipType);
  const stage = asString(payload?.stage);
  const status = asString(payload?.status);

  if (name) updates.name = name;
  if (relationshipType !== null) {
    if (!includesValue(relationshipType, RELATIONSHIP_TYPES)) {
      return jsonError("relationshipType is invalid.", 400);
    }
    updates.relationship_type = relationshipType;
  }
  if (stage !== null) {
    if (!includesValue(stage, ACCOUNT_STAGES)) {
      return jsonError("stage is invalid.", 400);
    }
    updates.stage = stage;
  }
  if (status !== null) {
    if (!includesValue(status, ACCOUNT_STATUSES)) {
      return jsonError("status is invalid.", 400);
    }
    updates.status = status;
  }

  if (Object.prototype.hasOwnProperty.call(payload ?? {}, "ownerUserId")) {
    const ownerUserId = asString(payload?.ownerUserId);
    if (!ownerUserId) {
      return jsonError("ownerUserId is invalid.", 400);
    }
    updates.owner_user_id = ownerUserId;
  }
  if (Object.prototype.hasOwnProperty.call(payload ?? {}, "nextFollowUpAt")) {
    const nextFollowUpAt = asNullableTimestamp(payload?.nextFollowUpAt);
    updates.next_follow_up_at = nextFollowUpAt;
  }
  if (Object.prototype.hasOwnProperty.call(payload ?? {}, "notes")) {
    updates.notes = asString(payload?.notes);
  }

  if (!Object.keys(updates).length) {
    return jsonError("No valid fields provided.", 400);
  }

  const admin = viewer.admin;
  const { data, error } = await admin
    .from("relationship_crm_accounts")
    .update(updates)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id,name,relationship_type,stage,status,owner_user_id,next_follow_up_at,notes,created_by,created_at,updated_at")
    .maybeSingle();

  if (error) {
    return jsonError(`Failed to update account: ${error.message}`, 500);
  }
  if (!data) {
    return jsonError("Account not found.", 404);
  }

  let owner = null;
  try {
    const profileByUserId = await loadCrmProfileMap(admin, [data.owner_user_id]);
    owner = profileByUserId.get(data.owner_user_id) ?? null;
  } catch (profileError) {
    console.error("[relationship-crm] account owner enrichment failed:", profileError);
  }

  return Response.json({
    account: {
      ...data,
      owner,
    },
  });
}
