import type { ScheduleEvent } from "@/modules/cohort-hub/landing-types";

function formatDate(value: string | null) {
  if (!value) return "Date TBD";
  const isoDateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = isoDateOnly
    ? new Date(Number(isoDateOnly[1]), Number(isoDateOnly[2]) - 1, Number(isoDateOnly[3]))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ScheduleTimeline({ events }: { events: ScheduleEvent[] }) {
  if (!events.length) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        Schedule coming soon.
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <li
          key={event.id}
          className="rounded-xl border border-border bg-card p-4 transition-transform duration-200 hover:-translate-y-0.5"
        >
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Day {event.day} · {formatDate(event.date)}
          </p>
          <p className="mt-1 font-semibold">{event.title}</p>
          {event.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>
          ) : null}
          {event.type ? (
            <span className="mt-2 inline-flex rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {event.type}
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
