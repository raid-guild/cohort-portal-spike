import { NextRequest } from "next/server";
import { requireAuth } from "../../_auth";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status ?? 401 });
  }

  const { id } = await context.params;

  const { data, error: loadError } = await auth.admin
    .from("looking_for_listings" as any)
    .select("id, created_by, status")
    .eq("id", id)
    .single();

  const listing = data as any;

  if (loadError || !listing) {
    return Response.json({ error: loadError?.message ?? "Listing not found." }, { status: 404 });
  }

  const isHost = auth.roles.includes("host");
  const isOwner = String(listing.created_by) === auth.userId;

  if (!isHost && !isOwner) {
    return Response.json({ error: "Not authorized." }, { status: 403 });
  }

  if (listing.status === "closed") {
    return Response.json({ ok: true });
  }

  const { error } = await auth.admin
    .from("looking_for_listings" as any)
    .update({ status: "closed" })
    .eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
