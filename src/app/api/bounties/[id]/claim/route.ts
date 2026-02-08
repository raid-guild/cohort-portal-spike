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

  const { data: bounty, error: bountyFetchError } = await auth.admin
    .from("bounties")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  if (bountyFetchError) {
    return Response.json({ error: bountyFetchError.message }, { status: 500 });
  }

  if (!bounty) {
    return Response.json({ error: "Bounty not found." }, { status: 404 });
  }

  if (bounty.status !== "open") {
    return Response.json(
      { error: `Bounty cannot be claimed when status is \"${bounty.status}\".` },
      { status: 409 },
    );
  }

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
    return Response.json({ error: "Bounty already claimed." }, { status: 409 });
  }

  const { data: claim, error: claimError } = await auth.admin
    .from("bounty_claims")
    .insert({ bounty_id: id, user_id: auth.userId, status: "claimed" })
    .select(
      "id, bounty_id, user_id, status, created_at, updated_at, submitted_at, resolved_at",
    )
    .single();

  if (claimError) {
    return Response.json({ error: claimError.message }, { status: 500 });
  }

  const { error: bountyUpdateError } = await auth.admin
    .from("bounties")
    .update({ status: "claimed" })
    .eq("id", id);

  if (bountyUpdateError) {
    return Response.json({ error: bountyUpdateError.message }, { status: 500 });
  }

  return Response.json({ claim });
}
