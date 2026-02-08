import { NextRequest } from "next/server";
import { requireHost } from "../../_auth";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireHost(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status ?? 403 });
  }

  const { id } = await context.params;
  const { data: activeClaim, error } = await auth.admin
    .from("bounty_claims")
    .select("id")
    .eq("bounty_id", id)
    .eq("status", "submitted")
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!activeClaim) {
    return Response.json({ error: "No submitted claim." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await auth.admin
    .from("bounty_claims")
    .update({ status: "accepted", resolved_at: now })
    .eq("id", activeClaim.id)
    .select("id, bounty_id, user_id, status, created_at, updated_at, submitted_at, resolved_at")
    .single();

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  await auth.admin.from("bounties").update({ status: "accepted" }).eq("id", id);

  return Response.json({ claim: updated });
}
