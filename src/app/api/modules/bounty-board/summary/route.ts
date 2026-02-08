import { supabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = supabaseAdminClient();

  const { count: openCount } = await admin
    .from("bounties")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: updatedCount } = await admin
    .from("bounties")
    .select("id", { count: "exact", head: true })
    .gte("updated_at", weekAgo);

  return Response.json({
    title: "Bounty Board",
    items: [
      { label: "Open", value: String(openCount ?? 0) },
      { label: "Updated (7d)", value: String(updatedCount ?? 0) },
    ],
  });
}
