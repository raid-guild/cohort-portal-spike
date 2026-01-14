import { loadPeople } from "@/lib/people";

export async function GET() {
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

  return Response.json({
    title: "Cohort Skills",
    items: [
      { label: "People", value: String(people.length) },
      { label: "Unique skills", value: String(uniqueSkills.size) },
      { label: "Top skill", value: top ? `${top[0]}` : "TBD" },
    ],
  });
}
