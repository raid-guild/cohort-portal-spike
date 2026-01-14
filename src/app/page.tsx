import Link from "next/link";
import { ModuleSurfaceList } from "@/components/ModuleSurfaceList";
import { loadRegistry } from "@/lib/registry";

export default function HomePage() {
  const registry = loadRegistry();
  const startHere = registry.modules.filter((mod) =>
    mod.tags?.includes("start-here"),
  );

  return (
    <div className="space-y-12">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold">{registry.cohort.theme}</h1>
        <p className="text-sm text-muted-foreground">
          {registry.cohort.startDate} → {registry.cohort.endDate} · Cohort ID{" "}
          {registry.cohort.id}
        </p>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Start Here</h2>
          <Link href="/modules" className="text-sm underline-offset-4 hover:underline">
            View all modules
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <ModuleSurfaceList modules={startHere} surface="home" />
        </div>
      </section>

    </div>
  );
}
