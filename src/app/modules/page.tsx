import { ModulesDirectory } from "@/components/ModulesDirectory";
import { loadRegistry } from "@/lib/registry";

export default function ModulesPage() {
  const registry = loadRegistry();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Module Directory</h1>
        <p className="text-sm text-muted-foreground">
          Browse modules by lane, status, or type. Each module can ship
          independently.
        </p>
      </div>
      <ModulesDirectory modules={registry.modules} />
    </div>
  );
}
