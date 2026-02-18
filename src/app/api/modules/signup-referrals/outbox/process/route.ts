import { NextRequest } from "next/server";
import { processSendGridOutboxBatch } from "@/lib/integrations/sendgrid-outbox";
import { requireHost } from "../../_auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const gate = await requireHost(request);
  if ("error" in gate) {
    return Response.json({ error: gate.error }, { status: gate.status ?? 500 });
  }

  let body: { limit?: unknown } = {};
  try {
    body = (await request.json()) as { limit?: unknown };
  } catch {
    body = {};
  }

  const limit =
    typeof body.limit === "number" && Number.isFinite(body.limit)
      ? Math.trunc(body.limit)
      : undefined;

  try {
    const result = await processSendGridOutboxBatch(limit);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Processor failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}

