import { NextRequest } from "next/server";
import { requireAuth } from "../../_auth";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status ?? 401 });
  }

  const { id } = await context.params;

  const { data: claim, error } = await auth.admin
    .from("bounty_claims")
    .select("id, user_id, status")
    .eq("bounty_id", id)
    .eq("user_id", auth.userId)
    .eq("status", "claimed")
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!claim) {
    return Response.json({ error: "You must claim this bounty first." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await auth.admin
    .from("bounty_claims")
    .update({ status: "submitted", submitted_at: now })
    .eq("id", claim.id)
    .select("id, bounty_id, user_id, status, created_at, updated_at, submitted_at, resolved_at")
    .single();

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  await auth.admin.from("bounties").update({ status: "submitted" }).eq("id", id);

  return Response.json({ claim: updated });
}
