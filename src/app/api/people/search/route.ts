import { supabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parseLimit(raw: string | null) {
  if (!raw) return DEFAULT_LIMIT;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function sanitizeSearchTerm(raw: string) {
  return raw.replace(/[%_,()]/g, "").trim();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = sanitizeSearchTerm(url.searchParams.get("q") ?? "");
  const skill = (url.searchParams.get("skill") ?? "").trim();
  const badge = (url.searchParams.get("badge") ?? "").trim();
  const limit = parseLimit(url.searchParams.get("limit"));

  const supabase = supabaseServerClient();
  let badgeUserIds: string[] | null = null;
  if (badge) {
    const { data: badgeRows, error: badgeError } = await supabase
      .from("user_badges")
      .select("user_id")
      .eq("badge_id", badge);
    if (badgeError) {
      return Response.json({ people: [] as Profile[] });
    }

    badgeUserIds = (badgeRows ?? []).map((row) => row.user_id).filter(Boolean) as string[];
    if (!badgeUserIds.length) {
      return Response.json({ people: [] as Profile[] });
    }
  }

  let query = supabase
    .from("profiles")
    .select(
      "user_id, handle, display_name, bio, avatar_url, wallet_address, email, links, cohorts, skills, roles, location, contact",
    )
    .order("display_name");

  if (q) {
    query = query.or(`display_name.ilike.%${q}%,handle.ilike.%${q}%,bio.ilike.%${q}%`);
  }
  if (skill) {
    query = query.contains("skills", [skill]);
  }
  if (badgeUserIds) {
    query = query.in("user_id", badgeUserIds);
  }
  query = query.limit(limit);

  const { data, error } = await query;
  if (error || !data) {
    return Response.json({ people: [] as Profile[] });
  }
  const rows = data;

  const people: Profile[] = rows.map((row) => ({
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
  }));

  return Response.json({ people });
}
