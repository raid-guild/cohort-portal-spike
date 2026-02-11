import { NextRequest } from "next/server";
import { requireAuth } from "@/app/api/looking-for/_auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status ?? 401 });
  }

  const openRequests = await auth.admin
    .from("looking_for_listings" as any)
    .select("id", { count: "exact", head: true })
    .eq("status", "open")
    .eq("type", "looking_for");

  const openOffers = await auth.admin
    .from("looking_for_listings" as any)
    .select("id", { count: "exact", head: true })
    .eq("status", "open")
    .eq("type", "offering");

  const recentlyFulfilled = await auth.admin
    .from("looking_for_listings" as any)
    .select("id", { count: "exact", head: true })
    .eq("status", "fulfilled")
    .gte("fulfilled_at", new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString());

  const anyError = openRequests.error || openOffers.error || recentlyFulfilled.error;
  if (anyError) {
    return Response.json({ error: anyError.message }, { status: 500 });
  }

  return Response.json({
    title: "Arcane Exchange",
    items: [
      { label: "Open requests", value: String(openRequests.count ?? 0) },
      { label: "Open offers", value: String(openOffers.count ?? 0) },
      { label: "Recently fulfilled", value: String(recentlyFulfilled.count ?? 0) },
    ],
  });
}
