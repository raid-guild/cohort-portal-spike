import type { Tables } from "@/lib/types/db";
import type { Profile } from "./types";
import { supabaseServerClient } from "./supabase/server";

type ProfileRow = Tables<"profiles">;

function mapProfileRow(row: ProfileRow): Profile {
  return {
    userId: row.user_id ?? undefined,
    handle: row.handle,
    displayName: row.display_name,
    bio: row.bio ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    walletAddress: row.wallet_address ?? undefined,
    email: row.email ?? undefined,
    links: (row.links as Profile["links"]) ?? undefined,
    cohorts: (row.cohorts as Profile["cohorts"]) ?? undefined,
    skills: row.skills ?? undefined,
    roles: row.roles ?? undefined,
    location: row.location ?? undefined,
    contact: (row.contact as Profile["contact"]) ?? undefined,
  };
}

export async function loadPeople(): Promise<Profile[]> {
  const supabase = supabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "user_id, handle, display_name, bio, avatar_url, wallet_address, email, links, cohorts, skills, roles, location, contact, created_at, updated_at",
    )
    .order("display_name");

  if (error || !data) {
    return [];
  }

  return data.map(mapProfileRow);
}

export async function loadPerson(handle: string): Promise<Profile | null> {
  const supabase = supabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "user_id, handle, display_name, bio, avatar_url, wallet_address, email, links, cohorts, skills, roles, location, contact, created_at, updated_at",
    )
    .eq("handle", handle)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapProfileRow(data);
}
