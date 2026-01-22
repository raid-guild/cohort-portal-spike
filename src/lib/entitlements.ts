import { supabaseAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/types/db";

type EntitlementRow = Tables<"entitlements">;

const buildActiveFilter = () => {
  const now = new Date().toISOString();
  return `expires_at.is.null,expires_at.gt.${now}`;
};

export async function loadActiveEntitledUserIds(
  entitlement: string,
  userIds?: string[],
): Promise<string[]> {
  const admin = supabaseAdminClient();
  let query = admin
    .from("entitlements")
    .select("user_id")
    .eq("entitlement", entitlement)
    .eq("status", "active")
    .or(buildActiveFilter());

  if (userIds?.length) {
    query = query.in("user_id", userIds);
  }

  const { data, error } = await query;
  if (error || !data) {
    return [];
  }

  return data.map((row) => row.user_id);
}

export async function loadUserEntitlement(
  userId: string,
  entitlement: string,
): Promise<EntitlementRow | null> {
  const admin = supabaseAdminClient();
  const { data, error } = await admin
    .from("entitlements")
    .select("*")
    .eq("user_id", userId)
    .eq("entitlement", entitlement)
    .eq("status", "active")
    .or(buildActiveFilter())
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}
