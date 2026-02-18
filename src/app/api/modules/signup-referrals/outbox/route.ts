import { NextRequest } from "next/server";
import { requireHost } from "../_auth";
import type { Json } from "@/lib/types/db";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parseLimit(value: string | null) {
  const parsed = Number(value ?? "");
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.trunc(parsed), MAX_LIMIT);
}

function payloadAsObject(payload: Json): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }
  return payload as Record<string, unknown>;
}

export async function GET(request: NextRequest) {
  const gate = await requireHost(request);
  if ("error" in gate) {
    return Response.json({ error: gate.error }, { status: gate.status ?? 500 });
  }

  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get("limit"));

  const { data, error } = await gate.admin
    .from("integration_outbox")
    .select("id,event_type,status,attempt_count,last_error,next_attempt_at,created_at,payload")
    .eq("event_type", "email_referral.created")
    .eq("status", "failed")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const items = (data ?? []).map((row) => {
    const payload = payloadAsObject(row.payload);
    const email = typeof payload.email === "string" ? payload.email : "";
    const emailReferralId =
      typeof payload.email_referral_id === "string" ? payload.email_referral_id : null;

    return {
      id: row.id,
      eventType: row.event_type,
      status: row.status,
      attemptCount: row.attempt_count,
      lastError: row.last_error,
      nextAttemptAt: row.next_attempt_at,
      createdAt: row.created_at,
      email,
      emailReferralId,
    };
  });

  return Response.json({ items });
}

export async function POST(request: NextRequest) {
  const gate = await requireHost(request);
  if ("error" in gate) {
    return Response.json({ error: gate.error }, { status: gate.status ?? 500 });
  }

  let body: { ids?: unknown };
  try {
    body = (await request.json()) as { ids?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const ids = Array.isArray(body.ids)
    ? body.ids
        .map((id) => Number(id))
        .filter((id): id is number => Number.isInteger(id) && id > 0)
    : [];

  if (!ids.length) {
    return Response.json({ error: "ids is required." }, { status: 400 });
  }

  const { data, error } = await gate.admin
    .from("integration_outbox")
    .update({
      status: "pending",
      attempt_count: 0,
      next_attempt_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .in("id", ids)
    .eq("event_type", "email_referral.created")
    .eq("status", "failed")
    .select("id");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    updatedCount: (data ?? []).length,
  });
}

