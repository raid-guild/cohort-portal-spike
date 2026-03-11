import { CohortCalendarModule } from "@/modules/cohort-calendar/CohortCalendarModule";

export default function CohortCalendarPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Cohort Calendar</h1>
        <p className="text-sm text-muted-foreground">
          Track cohort sessions, brown bags, and community calls in one place.
        </p>
      </div>
      <CohortCalendarModule />
    </div>
  );
}
