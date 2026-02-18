import { NextRequest } from "next/server";
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
      : 1000;

  const { data, error } = await gate.admin.rpc("backfill_email_referral_outbox", {
    p_limit: limit,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    queuedCount: typeof data === "number" ? data : 0,
  });
}
