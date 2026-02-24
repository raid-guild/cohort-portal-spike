import { EntitlementOnly } from "@/components/EntitlementOnly";
import { ModuleSurfaceList } from "@/components/ModuleSurfaceList";
import { loadRegistry } from "@/lib/registry";

const MEMBER_ENTITLEMENT = "dao-member";

export default function MemberPage() {
  const registry = loadRegistry();
  const memberTools = registry.modules.filter((mod) =>
    mod.tags?.includes("member-tools"),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Member Surface</h1>
        <p className="text-sm text-muted-foreground">
          DAO member modules for governance, proposals, and voting workflows.
        </p>
      </div>

      <EntitlementOnly entitlement={MEMBER_ENTITLEMENT}>
        {memberTools.length ? (
          <ModuleSurfaceList modules={memberTools} surface="member" />
        ) : (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            No member tools are configured yet. Tag modules with{" "}
            <span className="font-mono">member-tools</span> in the registry to surface
            them here.
          </div>
        )}
      </EntitlementOnly>
    </div>
  );
}
