import { supabaseAdminClient } from "@/lib/supabase/admin";
import { loadPeople } from "@/lib/people";
import { supabaseServerClient } from "@/lib/supabase/server";

type ViewTier = "public" | "authenticated" | "dao-member";

type SkillRoleCount = {
  label: string;
  count: number;
};

function topCounts(values: string[], limit: number): SkillRoleCount[] {
  const map = new Map<string, number>();
  values.forEach((value) => {
    map.set(value, (map.get(value) ?? 0) + 1);
  });
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

async function resolveTier(request: Request): Promise<ViewTier> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return "public";
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = supabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return "public";
  }

  const admin = supabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("entitlements")
    .select("entitlement")
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .or(`expires_at.is.null,expires_at.gt.${now}`);

  if (error || !data) {
    return "authenticated";
  }

  const entitlements = new Set(data.map((row) => row.entitlement));
  return entitlements.has("dao-member") ? "dao-member" : "authenticated";
}

export async function GET(request: Request) {
  const tier = await resolveTier(request);
  const people = await loadPeople();
  const allSkills = people.flatMap((person) => person.skills ?? []);
  const allRoles = people.flatMap((person) => person.roles ?? []);
  const uniqueSkills = Array.from(new Set(allSkills)).sort();
  const uniqueRoles = Array.from(new Set(allRoles)).sort();

  const payload = {
    tier,
    stats: {
      people: people.length,
      uniqueSkills: uniqueSkills.length,
      uniqueRoles: uniqueRoles.length,
    },
    topSkills: topCounts(allSkills, tier === "public" ? 6 : 10),
    topRoles: topCounts(allRoles, tier === "public" ? 0 : 10),
    skillIndex: tier === "public" ? uniqueSkills.slice(0, 24) : uniqueSkills,
    people:
      tier === "dao-member"
        ? people.map((person) => ({
            handle: person.handle,
            displayName: person.displayName,
            skills: person.skills ?? [],
            roles: person.roles ?? [],
          }))
        : [],
  };

  return Response.json(payload);
}
