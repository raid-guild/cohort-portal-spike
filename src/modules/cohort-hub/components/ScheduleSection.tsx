"use client";

import { useMemo, useState } from "react";
import type { ScheduleEvent } from "@/modules/cohort-hub/landing-types";
import { ScheduleCalendar } from "@/modules/cohort-hub/components/ScheduleCalendar";
import { ScheduleTimeline } from "@/modules/cohort-hub/components/ScheduleTimeline";

export function ScheduleSection({ events }: { events: ScheduleEvent[] }) {
  const [view, setView] = useState<"timeline" | "calendar">("timeline");

  const progress = useMemo(() => {
    if (!events.length) return { completed: 0, total: 0, percentage: 0 };
    const now = new Date();
    const withDates = events
      .map((event) => ({ event, date: event.date ? new Date(event.date) : null }))
      .filter((item) => item.date && !Number.isNaN(item.date.getTime()));

    if (!withDates.length) return { completed: 0, total: events.length, percentage: 0 };

    const completed = withDates.filter((item) => (item.date as Date) <= now).length;
    const total = withDates.length;
    const percentage = Math.max(0, Math.min(100, Math.round((completed / total) * 100)));

    return { completed, total, percentage };
  }, [events]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">
            Week progress: {progress.completed} of {progress.total}
          </p>
          <div className="mt-1 h-2 w-52 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all duration-700"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => setView("timeline")}
            className={`rounded border px-2 py-1 ${
              view === "timeline" ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
            }`}
          >
            Timeline
          </button>
          <button
            type="button"
            onClick={() => setView("calendar")}
            className={`rounded border px-2 py-1 ${
              view === "calendar" ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
            }`}
          >
            Calendar
          </button>
        </div>
      </div>
      {view === "timeline" ? <ScheduleTimeline events={events} /> : <ScheduleCalendar events={events} />}
    </div>
  );
}
