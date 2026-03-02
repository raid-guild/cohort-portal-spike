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
  const skill = sanitizeSearchTerm(url.searchParams.get("skill") ?? "");
  const limit = parseLimit(url.searchParams.get("limit"));
  if (q.length < 2 && !skill) {
    return Response.json({ error: "Query must be at least 2 characters." }, { status: 400 });
  }

  const supabase = supabaseServerClient();
  let query = supabase
    .from("profiles")
    .select("user_id, handle, display_name, bio, avatar_url, skills, roles, location")
    .order("display_name")
    .limit(limit);

  if (q) {
    query = query.or(`display_name.ilike.%${q}%,handle.ilike.%${q}%,bio.ilike.%${q}%`);
  }
  if (skill) {
    query = query.contains("skills", [skill]);
  }

  const { data, error } = await query;
  if (error || !data) {
    return Response.json({ people: [] as Profile[] });
  }

  const people: Profile[] = data.map((row) => ({
    userId: row.user_id ?? undefined,
    handle: row.handle,
    displayName: row.display_name,
    bio: row.bio ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    skills: row.skills ?? undefined,
    roles: row.roles ?? undefined,
    location: row.location ?? undefined,
  }));

  return Response.json({ people });
}
