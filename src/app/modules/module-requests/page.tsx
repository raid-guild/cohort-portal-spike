import { ModuleRequests } from "@/modules/module-requests/ModuleRequests";

export default function ModuleRequestsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Module Requests</h1>
        <p className="text-sm text-muted-foreground">
          Propose new portal modules and vote on what the cohort should build next.
        </p>
      </div>

      <ModuleRequests />
    </div>
  );
}
