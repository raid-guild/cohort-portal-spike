import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";
import { getWalletFromUser } from "@/lib/wallet-address";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json(
      { title: "DAO membership", items: [{ label: "Status", value: "Sign in" }] },
      { status: 401 },
    );
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = supabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return Response.json(
      { title: "DAO membership", items: [{ label: "Status", value: "Sign in" }] },
      { status: 401 },
    );
  }

  const wallet = getWalletFromUser(userData.user);
  const admin = supabaseAdminClient();

  const { data: memberships, error } = await admin
    .from("dao_memberships")
    .select("dao_id, chain_id, status, voting_power, user_id, wallet_address, last_synced_at")
    .or(
      wallet
        ? `user_id.eq.${userData.user.id},wallet_address.eq.${wallet}`
        : `user_id.eq.${userData.user.id}`,
    )
    .order("last_synced_at", { ascending: false });

  if (error) {
    return Response.json(
      { title: "DAO membership", items: [{ label: "Status", value: "Unavailable" }] },
      { status: 500 },
    );
  }

  const activeCount = (memberships ?? []).filter((row) => row.status === "active").length;
  const claimedCount = (memberships ?? []).filter((row) => row.user_id === userData.user.id)
    .length;
  const latest = memberships?.[0] ?? null;

  return Response.json({
    title: "DAO membership",
    items: [
      { label: "Active memberships", value: String(activeCount) },
      { label: "Claimed", value: String(claimedCount) },
      { label: "Wallet", value: wallet ?? "Not detected" },
      { label: "Latest DAO", value: latest ? `${latest.dao_id} (${latest.chain_id})` : "—" },
    ],
  });
}
