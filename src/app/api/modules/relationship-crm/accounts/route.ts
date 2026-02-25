import { NextRequest } from "next/server";
import {
  ACCOUNT_STAGES,
  ACCOUNT_STATUSES,
  RELATIONSHIP_TYPES,
  asNullableTimestamp,
  asString,
  includesValue,
  jsonError,
  parseLimit,
  requireCrmAccess,
} from "@/app/api/modules/relationship-crm/lib";

export async function GET(request: NextRequest) {
  const viewer = await requireCrmAccess(request);
  if ("error" in viewer) {
    return jsonError(viewer.error, viewer.status);
  }

  const query = new URL(request.url).searchParams;
  const stage = asString(query.get("stage"));
  const relationshipType = asString(query.get("relationshipType"));
  const owner = asString(query.get("owner"));
  const status = asString(query.get("status"));
  const q = asString(query.get("q"));
  const limit = parseLimit(query.get("limit"), 50, 200);

  const admin = viewer.admin;
  let dbQuery = admin
    .from("relationship_crm_accounts")
    .select("id,name,relationship_type,stage,status,owner_user_id,next_follow_up_at,updated_at,created_at")
    .is("deleted_at", null)
    .order("next_follow_up_at", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (includesValue(stage, ACCOUNT_STAGES)) {
    dbQuery = dbQuery.eq("stage", stage);
  }
  if (includesValue(relationshipType, RELATIONSHIP_TYPES)) {
    dbQuery = dbQuery.eq("relationship_type", relationshipType);
  }
  if (owner) {
    dbQuery = dbQuery.eq("owner_user_id", owner);
  }
  if (includesValue(status, ACCOUNT_STATUSES)) {
    dbQuery = dbQuery.eq("status", status);
  } else {
    dbQuery = dbQuery.eq("status", "active");
  }
  if (q) {
    const escaped = q.replace(/[%_,()]/g, "");
    dbQuery = dbQuery.or(`name.ilike.%${escaped}%,notes.ilike.%${escaped}%`);
  }

  const { data, error } = await dbQuery;
  if (error) {
    return jsonError(`Failed to load accounts: ${error.message}`, 500);
  }

  return Response.json({ accounts: data ?? [] });
}

export async function POST(request: NextRequest) {
  const viewer = await requireCrmAccess(request);
  if ("error" in viewer) {
    return jsonError(viewer.error, viewer.status);
  }

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = asString(payload?.name);
  const relationshipType = asString(payload?.relationshipType);
  const stage = asString(payload?.stage) ?? "lead";
  const status = asString(payload?.status) ?? "active";
  const ownerUserId = asString(payload?.ownerUserId) ?? viewer.userId;
  const nextFollowUpAt = asNullableTimestamp(payload?.nextFollowUpAt);
  const notes = asString(payload?.notes);

  if (!name) {
    return jsonError("name is required.", 400);
  }
  if (!includesValue(relationshipType, RELATIONSHIP_TYPES)) {
    return jsonError("relationshipType is invalid.", 400);
  }
  if (!includesValue(stage, ACCOUNT_STAGES)) {
    return jsonError("stage is invalid.", 400);
  }
  if (!includesValue(status, ACCOUNT_STATUSES)) {
    return jsonError("status is invalid.", 400);
  }

  const admin = viewer.admin;
  const { data, error } = await admin
    .from("relationship_crm_accounts")
    .insert({
      name,
      relationship_type: relationshipType,
      stage,
      status,
      owner_user_id: ownerUserId,
      next_follow_up_at: nextFollowUpAt,
      notes,
      created_by: viewer.userId,
    })
    .select("id,name,relationship_type,stage,status,owner_user_id,next_follow_up_at,notes,created_at,updated_at")
    .single();

  if (error) {
    return jsonError(`Failed to create account: ${error.message}`, 500);
  }

  return Response.json({ account: data }, { status: 201 });
}
