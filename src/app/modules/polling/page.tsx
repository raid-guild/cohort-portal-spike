import { PollingModule } from "@/modules/polling/PollingModule";

export default function PollingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Polling</h1>
        <p className="text-sm text-muted-foreground">
          Run reusable structured votes across cohort and DAO workflows.
        </p>
      </div>
      <PollingModule />
    </div>
  );
}
