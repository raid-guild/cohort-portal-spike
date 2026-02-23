import { HostOnly } from "@/components/HostOnly";
import { ModuleSurfaceList } from "@/components/ModuleSurfaceList";
import { loadRegistry } from "@/lib/registry";

export default function HostPage() {
  const registry = loadRegistry();
  const hostTools = registry.modules.filter((mod) => mod.tags?.includes("host-tools"));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Host Surface</h1>
        <p className="text-sm text-muted-foreground">
          Host-only tools and summaries for operating the cohort.
        </p>
      </div>

      <HostOnly>
        {hostTools.length ? (
          <ModuleSurfaceList modules={hostTools} surface="host" />
        ) : (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            No host tools are configured yet. Tag modules with{" "}
            <span className="font-mono">host-tools</span> in the registry to surface them
            here.
          </div>
        )}
      </HostOnly>
    </div>
  );
}
