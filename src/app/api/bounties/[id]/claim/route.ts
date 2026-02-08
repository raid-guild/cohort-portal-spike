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

  const { data: existing, error: existingError } = await auth.admin
    .from("bounty_claims")
    .select("id, user_id, status")
    .eq("bounty_id", id)
    .in("status", ["claimed", "submitted"])
    .maybeSingle();

  if (existingError) {
    return Response.json({ error: existingError.message }, { status: 500 });
  }

  if (existing) {
    return Response.json(
      { error: "Bounty already claimed." },
      { status: 409 },
    );
  }

  const { data: claim, error: claimError } = await auth.admin
    .from("bounty_claims")
    .insert({ bounty_id: id, user_id: auth.userId, status: "claimed" })
    .select("id, bounty_id, user_id, status, created_at, updated_at, submitted_at, resolved_at")
    .single();

  if (claimError) {
    return Response.json({ error: claimError.message }, { status: 500 });
  }

  const { error: bountyError } = await auth.admin
    .from("bounties")
    .update({ status: "claimed" })
    .eq("id", id);

  if (bountyError) {
    return Response.json({ error: bountyError.message }, { status: 500 });
  }

  return Response.json({ claim });
}
