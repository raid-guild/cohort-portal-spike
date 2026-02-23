import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";
import { getWalletFromUser } from "@/lib/wallet-address";

type ClaimPayload = {
  daoId?: string;
  chainId?: string;
};

const requireUserWithWallet = async (request: NextRequest) => {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Missing auth token.", status: 401 } as const;
  }
  const token = authHeader.replace("Bearer ", "");
  const supabase = supabaseServerClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { error: "Invalid auth token.", status: 401 } as const;
  }

  const wallet = getWalletFromUser(data.user);
  if (!wallet) {
    return {
      error: "Wallet not found in auth identity. Sign in with your wallet first.",
      status: 400,
    } as const;
  }

  return {
    user: data.user,
    wallet,
  } as const;
};

export async function GET(request: NextRequest) {
  const auth = await requireUserWithWallet(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const admin = supabaseAdminClient();
  const { data: memberships, error: membershipError } = await admin
    .from("dao_memberships")
    .select(
      "id, dao_id, chain_id, wallet_address, status, shares, loot, voting_power, user_id, profile_handle, last_synced_at, claimed_at",
    )
    .eq("wallet_address", auth.wallet)
    .order("last_synced_at", { ascending: false });

  if (membershipError) {
    return Response.json({ error: membershipError.message }, { status: 500 });
  }

  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("handle, display_name, user_id, wallet_address, created_at")
    .ilike("wallet_address", auth.wallet)
    .order("created_at", { ascending: true });

  if (profileError) {
    return Response.json({ error: profileError.message }, { status: 500 });
  }

  const activeMemberships = (memberships ?? []).filter((row) => row.status === "active");
  const ownedProfile =
    (profiles ?? []).find((row) => row.user_id === auth.user.id) ?? null;
  const unclaimedProfile =
    (profiles ?? []).find((row) => row.user_id == null) ?? null;

  return Response.json({
    walletAddress: auth.wallet,
    memberships: memberships ?? [],
    activeMemberships,
    ownedProfile,
    unclaimedProfile,
    canClaim: Boolean(activeMemberships.length && (unclaimedProfile || ownedProfile)),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireUserWithWallet(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  let payload: ClaimPayload = {};
  try {
    payload = (await request.json()) as ClaimPayload;
  } catch {
    payload = {};
  }

  const daoId = String(payload.daoId ?? "").trim().toLowerCase();
  const chainId = String(payload.chainId ?? "").trim();

  const admin = supabaseAdminClient();
  let membershipQuery = admin
    .from("dao_memberships")
    .select(
      "id, dao_id, chain_id, wallet_address, status, shares, loot, voting_power, user_id, profile_handle, source, verification",
    )
    .eq("wallet_address", auth.wallet)
    .eq("status", "active");

  if (daoId) membershipQuery = membershipQuery.eq("dao_id", daoId);
  if (chainId) membershipQuery = membershipQuery.eq("chain_id", chainId);

  const { data: memberships, error: membershipError } = await membershipQuery;
  if (membershipError) {
    return Response.json({ error: membershipError.message }, { status: 500 });
  }
  if (!memberships?.length) {
    return Response.json({ error: "No active DAO membership found for this wallet." }, { status: 404 });
  }
  if (memberships.length > 1) {
    return Response.json(
      { error: "Multiple active memberships found. Pass daoId and chainId to claim explicitly." },
      { status: 409 },
    );
  }

  const membership = memberships[0];
  if (membership.user_id && membership.user_id !== auth.user.id) {
    return Response.json({ error: "This membership has already been claimed by another user." }, { status: 409 });
  }

  if (!membership.user_id) {
    const { data: claimedMembership, error: claimMembershipError } = await admin
      .from("dao_memberships")
      .update({
        user_id: auth.user.id,
        claimed_at: new Date().toISOString(),
      })
      .eq("id", membership.id)
      .is("user_id", null)
      .select("id, user_id")
      .maybeSingle();

    if (claimMembershipError) {
      return Response.json({ error: claimMembershipError.message }, { status: 500 });
    }
    if (!claimedMembership) {
      const { data: reloaded, error: reloadError } = await admin
        .from("dao_memberships")
        .select("user_id")
        .eq("id", membership.id)
        .maybeSingle();
      if (reloadError) {
        return Response.json({ error: reloadError.message }, { status: 500 });
      }
      if (reloaded?.user_id && reloaded.user_id !== auth.user.id) {
        return Response.json(
          { error: "This membership was claimed by another user." },
          { status: 409 },
        );
      }
    }
  }

  const { data: matchingProfiles, error: profileLookupError } = await admin
    .from("profiles")
    .select("handle, user_id, wallet_address, display_name, created_at")
    .ilike("wallet_address", auth.wallet)
    .order("created_at", { ascending: true });

  if (profileLookupError) {
    return Response.json({ error: profileLookupError.message }, { status: 500 });
  }

  const ownedProfile =
    (matchingProfiles ?? []).find((row) => row.user_id === auth.user.id) ?? null;
  const unclaimedProfile =
    (matchingProfiles ?? []).find((row) => row.user_id == null) ?? null;
  const foreignClaimed =
    (matchingProfiles ?? []).find(
      (row) => row.user_id != null && row.user_id !== auth.user.id,
    ) ?? null;

  if (!ownedProfile && !unclaimedProfile && foreignClaimed) {
    return Response.json(
      { error: "A wallet-matching profile is already claimed by another user." },
      { status: 409 },
    );
  }

  let claimedProfileHandle: string | null = ownedProfile?.handle ?? null;
  if (!claimedProfileHandle && unclaimedProfile) {
    const { data: claimProfileData, error: claimProfileError } = await admin
      .from("profiles")
      .update({ user_id: auth.user.id })
      .eq("handle", unclaimedProfile.handle)
      .is("user_id", null)
      .select("handle, user_id")
      .maybeSingle();

    if (claimProfileError) {
      return Response.json({ error: claimProfileError.message }, { status: 500 });
    }

    if (!claimProfileData) {
      const { data: reloaded } = await admin
        .from("profiles")
        .select("handle, user_id")
        .eq("handle", unclaimedProfile.handle)
        .maybeSingle();
      if (reloaded?.user_id && reloaded.user_id !== auth.user.id) {
        return Response.json({ error: "Profile was claimed by another user." }, { status: 409 });
      }
      claimedProfileHandle =
        reloaded && reloaded.user_id === auth.user.id ? reloaded.handle : null;
    } else {
      claimedProfileHandle = claimProfileData.handle;
    }
  }

  if (claimedProfileHandle) {
    const { error: profileHandleError } = await admin
      .from("dao_memberships")
      .update({ profile_handle: claimedProfileHandle })
      .eq("id", membership.id);
    if (profileHandleError) {
      return Response.json({ error: profileHandleError.message }, { status: 500 });
    }
  }

  const entitlementMetadata = {
    source: "dao-claim",
    dao_id: membership.dao_id,
    chain_id: membership.chain_id,
    wallet_address: auth.wallet,
    shares: membership.shares,
    loot: membership.loot,
    voting_power: membership.voting_power,
    verified_at: new Date().toISOString(),
  };
  const { error: entitlementError } = await admin.from("entitlements").upsert(
    {
      user_id: auth.user.id,
      entitlement: "dao-member",
      status: "active",
      metadata: entitlementMetadata,
    },
    { onConflict: "user_id,entitlement" },
  );

  if (entitlementError) {
    return Response.json({ error: entitlementError.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    walletAddress: auth.wallet,
    claimedMembershipId: membership.id,
    claimedProfileHandle,
    entitlement: "dao-member",
  });
}
