import { ModuleRequestCreateForm } from "@/modules/module-requests/ModuleRequestCreateForm";

export default function ModuleRequestsNewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">New module request</h1>
        <p className="text-sm text-muted-foreground">
          Start a draft. Publish when it’s ready for others to vote.
        </p>
      </div>

      <ModuleRequestCreateForm />
    </div>
  );
}
