import { NextRequest } from "next/server";
import {
  INTERACTION_TYPES,
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

  const summary = asString(payload?.summary);
  const interactionType = asString(payload?.interactionType) ?? "note";
  const contactId = asString(payload?.contactId);
  const interactionAt = asNullableTimestamp(payload?.interactionAt) ?? new Date().toISOString();

  if (!summary) {
    return jsonError("summary is required.", 400);
  }
  if (!includesValue(interactionType, INTERACTION_TYPES)) {
    return jsonError("interactionType is invalid.", 400);
  }

  const exists = await accountExists(viewer.admin, accountId);
  if (!exists) {
    return jsonError("Account not found.", 404);
  }

  const admin = asUntypedAdmin(viewer.admin);
  const { data, error } = await admin
    .from("relationship_crm_interactions")
    .insert({
      account_id: accountId,
      contact_id: contactId,
      interaction_type: interactionType,
      summary,
      interaction_at: interactionAt,
      created_by: viewer.userId,
    })
    .select("id,account_id,contact_id,interaction_type,summary,interaction_at,created_by,created_at")
    .single();

  if (error) {
    return jsonError(`Failed to add interaction: ${error.message}`, 500);
  }

  return Response.json({ interaction: data }, { status: 201 });
}
