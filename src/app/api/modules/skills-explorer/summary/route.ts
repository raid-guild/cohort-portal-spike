import { supabaseAdminClient } from "@/lib/supabase/admin";
import { loadPeople } from "@/lib/people";
import { supabaseServerClient } from "@/lib/supabase/server";

type ViewTier = "public" | "authenticated" | "dao-member";

async function resolveTier(request: Request): Promise<ViewTier> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return "public";
  }

  const token = authHeader.replace("Bearer ", "");
  let userId: string;
  try {
    const supabase = supabaseServerClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return "public";
    }
    userId = userData.user.id;
  } catch {
    return "public";
  }

  try {
    const admin = supabaseAdminClient();
    const now = new Date().toISOString();
    const { data, error } = await admin
      .from("entitlements")
      .select("entitlement")
      .eq("user_id", userId)
      .eq("status", "active")
      .or(`expires_at.is.null,expires_at.gt.${now}`);

    if (error || !data) {
      return "authenticated";
    }

    const entitlements = new Set(data.map((row) => row.entitlement));
    return entitlements.has("dao-member") ? "dao-member" : "authenticated";
  } catch {
    return "authenticated";
  }
}

export async function GET(request: Request) {
  const tier = await resolveTier(request);
  const people = await loadPeople();
  const allSkills = people.flatMap((person) => person.skills ?? []);
  const uniqueSkills = new Set(allSkills);
  const map = new Map<string, number>();

  allSkills.forEach((skill) => {
    map.set(skill, (map.get(skill) ?? 0) + 1);
  });

  const top = Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .at(0);

  const visibility =
    tier === "dao-member"
      ? "DAO detail"
      : tier === "authenticated"
        ? "Authenticated aggregate"
        : "Public aggregate";

  return Response.json({
    title: "Cohort Skills",
    items: [
      { label: "People", value: String(people.length) },
      { label: "Unique skills", value: String(uniqueSkills.size) },
      { label: "Top skill", value: top ? `${top[0]}` : "TBD" },
      { label: "View", value: visibility },
    ],
  });
}
