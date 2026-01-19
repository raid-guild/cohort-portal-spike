import { ModuleSurfaceList } from "@/components/ModuleSurfaceList";
import { PeopleDirectory } from "@/components/PeopleDirectory";
import { loadPeople } from "@/lib/people";
import { loadRegistry } from "@/lib/registry";
import { loadActiveEntitledUserIds } from "@/lib/entitlements";

export default async function PeoplePage() {
  const people = await loadPeople();
  const userIds = people.map((person) => person.userId).filter(Boolean) as string[];
  const paidUserIds = await loadActiveEntitledUserIds("cohort-access", userIds);
  const registry = loadRegistry();
  const peopleTools = registry.modules.filter((mod) =>
    mod.tags?.includes("people-tools"),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">People Directory</h1>
        <p className="text-sm text-muted-foreground">
          Discover Raiders by skill, role, and cohort contributions.
        </p>
      </div>
      {peopleTools.length ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">People Tools</h2>
          </div>
          <ModuleSurfaceList modules={peopleTools} surface="people" />
        </section>
      ) : null}
      <PeopleDirectory people={people} paidUserIds={paidUserIds} />
    </div>
  );
}
