import { NextRequest } from "next/server";
import { enqueueNotificationDigests } from "@/lib/integrations/notifications-digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const rawMaxUsers = Number(url.searchParams.get("maxUsers") ?? "");
  const maxUsers =
    Number.isFinite(rawMaxUsers) && rawMaxUsers > 0 ? Math.trunc(rawMaxUsers) : undefined;

  try {
    const result = await enqueueNotificationDigests(maxUsers);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Enqueue failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
