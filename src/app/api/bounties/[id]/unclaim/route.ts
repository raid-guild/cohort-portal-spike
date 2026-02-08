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
  const isHost = auth.roles.includes("host");

  const { data: activeClaim, error } = await auth.admin
    .from("bounty_claims")
    .select("id, user_id, status")
    .eq("bounty_id", id)
    .in("status", ["claimed", "submitted"])
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!activeClaim) {
    return Response.json({ error: "No active claim." }, { status: 400 });
  }

  if (!isHost && activeClaim.user_id !== auth.userId) {
    return Response.json({ error: "Only host or claimer can unclaim." }, { status: 403 });
  }

  const { data: updated, error: updateError } = await auth.admin
    .from("bounty_claims")
    .update({ status: "rejected", resolved_at: new Date().toISOString() })
    .eq("id", activeClaim.id)
    .select("id, bounty_id, user_id, status, created_at, updated_at, submitted_at, resolved_at")
    .single();

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  const { error: bountyError } = await auth.admin
    .from("bounties")
    .update({ status: "open" })
    .eq("id", id);

  if (bountyError) {
    return Response.json({ error: bountyError.message }, { status: 500 });
  }

  return Response.json({ claim: updated });
}
