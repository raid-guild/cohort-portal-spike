import { NextRequest } from "next/server";
import {
  CONTACT_CHANNELS,
  accountExists,
  asBoolean,
  asString,
  includesValue,
  isUuid,
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
  if (!isUuid(accountId)) {
    return jsonError("Invalid account id.", 400);
  }
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  const fullName = asString(payload?.fullName);
  const roleTitle = asString(payload?.roleTitle);
  const email = asString(payload?.email);
  const phone = asString(payload?.phone);
  const preferredChannel = asString(payload?.preferredChannel);
  const isPrimary = asBoolean(payload?.isPrimary, false);

  if (!fullName) {
    return jsonError("fullName is required.", 400);
  }
  if (preferredChannel !== null && !includesValue(preferredChannel, CONTACT_CHANNELS)) {
    return jsonError("preferredChannel is invalid.", 400);
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
    .from("relationship_crm_contacts")
    .insert({
      account_id: accountId,
      full_name: fullName,
      role_title: roleTitle,
      email,
      phone,
      preferred_channel: preferredChannel,
      is_primary: isPrimary,
    })
    .select("id,account_id,full_name,role_title,email,phone,preferred_channel,is_primary,created_at,updated_at")
    .single();

  if (error) {
    return jsonError(`Failed to add contact: ${error.message}`, 500);
  }

  return Response.json({ contact: data }, { status: 201 });
}
