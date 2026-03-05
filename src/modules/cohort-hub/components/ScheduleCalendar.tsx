"use client";

import { useMemo, useState } from "react";
import type { ScheduleEvent } from "@/modules/cohort-hub/landing-types";

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(raw: string | null) {
  if (!raw) return null;
  const isoDateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateOnly) {
    const [, year, month, day] = isoDateOnly;
    const localDate = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(localDate.getTime()) ? null : localDate;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function ScheduleCalendar({ events }: { events: ScheduleEvent[] }) {
  const firstDate = useMemo(() => {
    for (const event of events) {
      const date = parseDate(event.date);
      if (date) return date;
    }
    return new Date();
  }, [events]);

  const [month, setMonth] = useState(new Date(firstDate.getFullYear(), firstDate.getMonth(), 1));
  const days = useMemo(() => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const leading = start.getDay();
    const total = end.getDate();
    const cells: (Date | null)[] = [];

    for (let i = 0; i < leading; i += 1) cells.push(null);
    for (let day = 1; day <= total; day += 1) {
      cells.push(new Date(month.getFullYear(), month.getMonth(), day));
    }

    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [month]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, ScheduleEvent[]>();
    for (const event of events) {
      const date = parseDate(event.date);
      if (!date) continue;
      const key = toDateKey(date);
      const current = map.get(key) ?? [];
      current.push(event);
      map.set(key, current);
    }
    return map;
  }, [events]);

  const visibleEvents = useMemo(() => {
    const key = toMonthKey(month);
    return events.filter((event) => {
      const date = parseDate(event.date);
      if (!date) return false;
      return toMonthKey(date) === key;
    });
  }, [events, month]);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
          aria-label="Previous month"
        >
          Prev
        </button>
        <p className="font-semibold">
          {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
        <button
          type="button"
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
          aria-label="Next month"
        >
          Next
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {[
          "Sun",
          "Mon",
          "Tue",
          "Wed",
          "Thu",
          "Fri",
          "Sat",
        ].map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          if (!day) return <div key={`empty-${index}`} className="h-12 rounded-md" aria-hidden="true" />;
          const key = toDateKey(day);
          const hasEvents = (eventsByDate.get(key) ?? []).length > 0;
          const isToday = key === toDateKey(new Date());
          return (
            <div
              key={key}
              className={`h-12 rounded-md border p-1 text-xs ${
                hasEvents ? "border-primary/50 bg-primary/10" : "border-border"
              } ${isToday ? "ring-1 ring-primary" : ""}`}
            >
              <div className="flex items-start justify-between">
                <span>{day.getDate()}</span>
                {hasEvents ? <span className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-sm font-semibold">Events this month</p>
        {visibleEvents.length ? (
          visibleEvents.map((event) => (
            <div key={`month-${event.id}`} className="rounded-lg border border-border p-2 text-sm">
              <p className="font-medium">{event.title}</p>
              <p className="text-xs text-muted-foreground">
                {parseDate(event.date)?.toLocaleDateString("en-US") ?? "Date TBD"}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No events this month.</p>
        )}
      </div>
    </div>
  );
}
