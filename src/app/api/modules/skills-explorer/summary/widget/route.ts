import { supabaseAdminClient } from "@/lib/supabase/admin";
import { loadPeople } from "@/lib/people";
import { supabaseServerClient } from "@/lib/supabase/server";

type ViewTier = "public" | "authenticated" | "dao-member";

type GraphNode = {
  id: string;
  label: string;
  group?: "person" | "skill" | "role";
};

type GraphLink = {
  source: string;
  target: string;
};

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

function topCounts(values: string[], limit: number) {
  const map = new Map<string, number>();
  values.forEach((value) => {
    map.set(value, (map.get(value) ?? 0) + 1);
  });
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function buildGraphForTier(
  tier: ViewTier,
  people: Array<{
    handle: string;
    displayName: string;
    skills: string[];
    roles: string[];
  }>,
) {
  const topSkills = topCounts(people.flatMap((person) => person.skills), 6).map(
    (entry) => entry.label,
  );
  const topRoles = topCounts(people.flatMap((person) => person.roles), 4).map(
    (entry) => entry.label,
  );

  const skillNodes: GraphNode[] = topSkills.map((skill) => ({
    id: `skill:${skill}`,
    label: skill,
    group: "skill",
  }));
  const roleNodes: GraphNode[] = topRoles.map((role) => ({
    id: `role:${role}`,
    label: role,
    group: "role",
  }));

  const links: GraphLink[] = [];
  people.forEach((person) => {
    const personSkills = person.skills.filter((skill) => topSkills.includes(skill));
    const personRoles = person.roles.filter((role) => topRoles.includes(role));
    personSkills.forEach((skill) => {
      personRoles.forEach((role) => {
        links.push({ source: `skill:${skill}`, target: `role:${role}` });
      });
    });
  });

  if (tier !== "dao-member") {
    return {
      nodes: [...skillNodes, ...roleNodes],
      links,
    };
  }

  const personNodes: GraphNode[] = people.slice(0, 12).map((person) => ({
    id: `person:${person.handle}`,
    label: person.displayName || person.handle,
    group: "person",
  }));
  const personLinks: GraphLink[] = [];
  people.slice(0, 12).forEach((person) => {
    person.skills
      .filter((skill) => topSkills.includes(skill))
      .forEach((skill) => {
        personLinks.push({
          source: `person:${person.handle}`,
          target: `skill:${skill}`,
        });
      });
    person.roles
      .filter((role) => topRoles.includes(role))
      .forEach((role) => {
        personLinks.push({
          source: `person:${person.handle}`,
          target: `role:${role}`,
        });
      });
  });

  return {
    nodes: [...personNodes, ...skillNodes, ...roleNodes],
    links: [...links, ...personLinks],
  };
}

export async function GET(request: Request) {
  const tier = await resolveTier(request);
  const peopleRaw = await loadPeople();
  const people = peopleRaw.map((person) => ({
    handle: person.handle,
    displayName: person.displayName,
    skills: person.skills ?? [],
    roles: person.roles ?? [],
  }));
  const allSkills = people.flatMap((person) => person.skills);
  const uniqueSkills = new Set(allSkills);
  const topSkill = topCounts(allSkills, 1)[0]?.label ?? "TBD";
  const graphData = buildGraphForTier(tier, people);

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
      { label: "Top skill", value: topSkill },
      { label: "View", value: visibility },
    ],
    widget: {
      mode: "data",
      type: "chart",
      variant: "force-graph",
      data: graphData,
    },
  });
}
