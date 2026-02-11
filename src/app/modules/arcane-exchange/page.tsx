import { ArcaneExchange } from "@/modules/arcane-exchange/ArcaneExchange";

export default function ArcaneExchangeModulePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Arcane Exchange</h1>
        <p className="text-sm text-muted-foreground">
          A lightweight internal marketplace for the cohort: requests, offers, and connections.
        </p>
      </div>
      <ArcaneExchange />
    </div>
  );
}
