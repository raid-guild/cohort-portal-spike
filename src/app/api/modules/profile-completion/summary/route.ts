import { NextRequest } from "next/server";
import { getProfileCompletion } from "@/lib/profile-completion";
import { supabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/types/db";

type ProfileRow = Tables<"profiles">;

function toProfile(row: ProfileRow) {
  return {
    userId: row.user_id ?? undefined,
    handle: row.handle,
    displayName: row.display_name,
    bio: row.bio ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    walletAddress: row.wallet_address ?? undefined,
    email: row.email ?? undefined,
    links: (row.links as { label: string; url: string }[]) ?? undefined,
    cohorts:
      (row.cohorts as { id: string; role?: string; year?: number }[]) ??
      undefined,
    skills: row.skills ?? undefined,
    roles: row.roles ?? undefined,
    location: row.location ?? undefined,
    contact: (row.contact as {
      farcaster?: string;
      telegram?: string;
      email?: string;
    }) ?? undefined,
  };
}

export async function GET(request: NextRequest) {
  const supabase = supabaseServerClient();
  const { searchParams } = new URL(request.url);
  const handle = searchParams.get("handle");

  if (handle) {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "user_id, handle, display_name, bio, avatar_url, wallet_address, email, links, cohorts, skills, roles, location, contact, created_at, updated_at",
      )
      .eq("handle", handle)
      .maybeSingle();

    if (error || !data) {
      return Response.json({ title: "Completion", items: [] });
    }

    const profile = toProfile(data);
    const completion = getProfileCompletion(profile, profile.email ?? null);

    return Response.json({
      title: "Completion",
      items: [
        { label: "Progress", value: `${completion.percent}%` },
        { label: "Missing", value: String(completion.missing) },
      ],
    });
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ title: "Completion", items: [] }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return Response.json({ title: "Completion", items: [] }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "user_id, handle, display_name, bio, avatar_url, wallet_address, email, links, cohorts, skills, roles, location, contact, created_at, updated_at",
    )
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (error || !data) {
    return Response.json({ title: "Completion", items: [] });
  }

  const profile = toProfile(data);
  const completion = getProfileCompletion(profile, userData.user.email ?? null);

  return Response.json({
    title: "Completion",
    items: [
      { label: "Progress", value: `${completion.percent}%` },
      { label: "Missing", value: String(completion.missing) },
    ],
  });
}
