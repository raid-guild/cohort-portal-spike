import { NextRequest } from "next/server";
import { supabaseServerClient } from "@/lib/supabase/server";
import {
  emitPortalEvent,
  PORTAL_EVENT_VISIBILITIES,
  verifyModuleKey,
} from "@/lib/portal-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  moduleId?: unknown;
  kind?: unknown;
  actorId?: unknown;
  subject?: unknown;
  data?: unknown;
  visibility?: unknown;
  occurredAt?: unknown;
  source?: unknown;
  dedupeKey?: unknown;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

async function getViewerId(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const supabase = supabaseServerClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

export async function POST(request: NextRequest) {
  let body: Body | null = null;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const moduleIdFromBody = asString(body?.moduleId);
  const moduleIdFromHeader = asString(request.headers.get("x-module-id"));
  const moduleId = moduleIdFromBody || moduleIdFromHeader;
  const moduleKey = asString(request.headers.get("x-module-key"));
  const kind = asString(body?.kind);

  if (!moduleId) {
    return Response.json({ error: "moduleId is required." }, { status: 400 });
  }
  if (!kind) {
    return Response.json({ error: "kind is required." }, { status: 400 });
  }

  const viewerId = await getViewerId(request);
  const moduleKeyValid = moduleKey ? await verifyModuleKey(moduleId, moduleKey) : false;

  if (!viewerId && !moduleKeyValid) {
    return Response.json(
      { error: "Unauthorized. Provide a valid user token or module key." },
      { status: 401 },
    );
  }
  if (kind.startsWith("core.") && !moduleKeyValid) {
    return Response.json({ error: "Valid module key required to emit core.* events." }, { status: 403 });
  }

  const actorIdRaw = asString(body?.actorId);
  const actorId = actorIdRaw || viewerId || null;
  if (viewerId && actorId && actorId !== viewerId) {
    return Response.json({ error: "actorId must match authenticated user." }, { status: 403 });
  }

  const visibilityRaw = asString(body?.visibility);
  if (
    visibilityRaw &&
    !PORTAL_EVENT_VISIBILITIES.includes(
      visibilityRaw as (typeof PORTAL_EVENT_VISIBILITIES)[number],
    )
  ) {
    return Response.json({ error: "Invalid visibility." }, { status: 400 });
  }

  const subjectRaw = body?.subject;
  const subject = subjectRaw === undefined ? null : asRecord(subjectRaw);
  if (subjectRaw !== undefined && subjectRaw !== null && !subject) {
    return Response.json({ error: "subject must be an object." }, { status: 400 });
  }

  try {
    await emitPortalEvent({
      moduleId,
      kind,
      authenticatedUserId: viewerId,
      actorId,
      subject,
      data: body?.data,
      visibility:
        (visibilityRaw as (typeof PORTAL_EVENT_VISIBILITIES)[number]) || undefined,
      occurredAt: asString(body?.occurredAt) || null,
      source: asString(body?.source) || null,
      dedupeKey: asString(body?.dedupeKey) || null,
    });
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to emit event.";
    const status =
      message.toLowerCase().includes("not allowed") ||
      message.toLowerCase().includes("required")
        ? 403
        : 400;
    return Response.json({ error: message }, { status });
  }
}
