import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";

export type DaoMemberSnapshot = {
  id: string;
  dao_id: string;
  chain_id: string;
  shares: string;
  loot: string;
  voting_power: string;
  wallet_address: string;
  last_synced_at: string;
};

export type DaoMemberOverview = {
  memberships: DaoMemberSnapshot[];
  totals: {
    activeMemberships: number;
    shares: string;
    loot: string;
    votingPower: string;
  };
  lastSyncedAt: string | null;
};

type AuthState =
  | { userId: string }
  | { error: string; status: number };

export async function requireDaoMember(request: NextRequest): Promise<AuthState> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Missing auth token.", status: 401 };
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = supabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return { error: "Invalid auth token.", status: 401 };
  }

  const admin = supabaseAdminClient();
  const now = new Date().toISOString();
  const { data: entitlement, error: entitlementError } = await admin
    .from("entitlements")
    .select("entitlement")
    .eq("user_id", userData.user.id)
    .eq("entitlement", "dao-member")
    .eq("status", "active")
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .maybeSingle();

  if (entitlementError || !entitlement) {
    return { error: "DAO member entitlement required.", status: 403 };
  }

  return { userId: userData.user.id };
}

function sumWholeNumbers(values: string[]) {
  let total = BigInt(0);
  for (const value of values) {
    const normalized = (value ?? "").trim();
    if (!normalized) continue;
    const integerPart = normalized.split(".")[0] ?? "0";
    const parsed = integerPart === "" || integerPart === "-" ? "0" : integerPart;
    try {
      total += BigInt(parsed);
    } catch {
      continue;
    }
  }
  return total.toString();
}

export async function loadDaoMemberOverview(userId: string): Promise<DaoMemberOverview> {
  const admin = supabaseAdminClient();
  const { data, error } = await admin
    .from("dao_memberships")
    .select("id,dao_id,chain_id,shares,loot,voting_power,wallet_address,last_synced_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("last_synced_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const memberships = (data ?? []) as DaoMemberSnapshot[];
  const overview: DaoMemberOverview = {
    memberships,
    totals: {
      activeMemberships: memberships.length,
      shares: sumWholeNumbers(memberships.map((item) => item.shares)),
      loot: sumWholeNumbers(memberships.map((item) => item.loot)),
      votingPower: sumWholeNumbers(memberships.map((item) => item.voting_power)),
    },
    lastSyncedAt: memberships[0]?.last_synced_at ?? null,
  };

  return overview;
}
