import { NextRequest } from "next/server";
import { requireAuth } from "@/app/api/bounties/_auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status ?? 401 });
  }

  const admin = auth.admin;

  const { count: openCount, error: openError } = await admin
    .from("bounties")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");

  if (openError) {
    return Response.json({ error: openError.message }, { status: 500 });
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: updatedCount, error: updatedError } = await admin
    .from("bounties")
    .select("id", { count: "exact", head: true })
    .gte("updated_at", weekAgo);

  if (updatedError) {
    return Response.json({ error: updatedError.message }, { status: 500 });
  }

  return Response.json({
    title: "Bounty Board",
    items: [
      { label: "Open", value: String(openCount ?? 0) },
      { label: "Updated (7d)", value: String(updatedCount ?? 0) },
    ],
  });
}
