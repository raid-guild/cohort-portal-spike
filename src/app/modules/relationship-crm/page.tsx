import { RelationshipCrm } from "@/modules/relationship-crm/RelationshipCrm";

export default function RelationshipCrmPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Relationship CRM</h1>
        <p className="text-sm text-muted-foreground">
          Track sponsor, partner, and client relationships with shared account history and follow-up
          tasks.
        </p>
      </div>
      <RelationshipCrm />
    </div>
  );
}
