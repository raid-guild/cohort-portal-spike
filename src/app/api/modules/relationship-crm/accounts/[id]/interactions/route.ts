import { NextRequest } from "next/server";
import {
  INTERACTION_TYPES,
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
  if (contactId && !isUuid(contactId)) {
    return jsonError("contactId is invalid.", 400);
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
  if (contactId) {
    const { data: contact, error: contactError } = await admin
      .from("relationship_crm_contacts")
      .select("id")
      .eq("id", contactId)
      .eq("account_id", accountId)
      .maybeSingle();

    if (contactError) {
      return jsonError(`Failed to validate contact: ${contactError.message}`, 500);
    }
    if (!contact) {
      return jsonError("contactId does not belong to this account.", 400);
    }
  }

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

  try {
    const profileByUserId = await loadCrmProfileMap(admin, [data.created_by]);
    return Response.json(
      {
        interaction: {
          ...data,
          author: profileByUserId.get(data.created_by) ?? null,
        },
      },
      { status: 201 },
    );
  } catch (profileError) {
    return jsonError(
      `Failed to resolve interaction author: ${
        profileError instanceof Error ? profileError.message : "Unknown error"
      }`,
      500,
    );
  }
}
