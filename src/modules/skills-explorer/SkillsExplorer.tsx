import { loadPeople } from "@/lib/people";
import { SkillsGraph } from "./SkillsGraph";

type SkillCount = {
  skill: string;
  count: number;
};

function getTopSkills(skills: string[]): SkillCount[] {
  const map = new Map<string, number>();
  skills.forEach((skill) => {
    map.set(skill, (map.get(skill) ?? 0) + 1);
  });
  return Array.from(map.entries())
    .map(([skill, count]) => ({ skill, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

export async function SkillsExplorer() {
  const people = await loadPeople();
  const allSkills = people.flatMap((person) => person.skills ?? []);
  const allRoles = people.flatMap((person) => person.roles ?? []);
  const uniqueSkills = Array.from(new Set(allSkills)).sort();
  const uniqueRoles = Array.from(new Set(allRoles)).sort();
  const topSkills = getTopSkills(allSkills);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs text-muted-foreground">People</div>
          <div className="text-2xl font-semibold">{people.length}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs text-muted-foreground">Unique skills</div>
          <div className="text-2xl font-semibold">{uniqueSkills.length}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs text-muted-foreground">Unique roles</div>
          <div className="text-2xl font-semibold">{uniqueRoles.length}</div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Skill & Role Graph</h2>
          <p className="text-xs text-muted-foreground">
            Drag nodes to explore relationships.
          </p>
        </div>
        <div className="mt-4 h-[520px] overflow-hidden rounded-xl border border-border bg-background">
          <SkillsGraph people={people} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Top Skills</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {topSkills.map((entry) => (
            <div
              key={entry.skill}
              className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm"
            >
              <span>{entry.skill}</span>
              <span className="text-muted-foreground">{entry.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Skill Index</h2>
        <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted-foreground">
          {uniqueSkills.map((skill) => (
            <span
              key={skill}
              className="rounded-full border border-border px-3 py-1"
            >
              {skill}
            </span>
          ))}
          {!uniqueSkills.length ? (
            <span className="text-muted-foreground">
              No skills yet. Add them on your profile.
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
