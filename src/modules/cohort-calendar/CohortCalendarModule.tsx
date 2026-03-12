"use client";

import { useEffect, useMemo, useState } from "react";
import { ProfileIdentity } from "@/components/profile/ProfileIdentity";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import {
  buildGoogleCalendarUrl,
  CALENDAR_ATTENDEE_STATUSES,
  CALENDAR_EVENT_TYPE_META,
  CALENDAR_EVENT_TYPES,
  CALENDAR_VISIBILITIES,
  getCalendarEventTemplate,
  type CalendarAttendeeStatus,
  type CalendarEventRecord,
  type CalendarEventType,
  type CalendarVisibility,
} from "./shared";

type ViewMode = "agenda" | "month";

type CalendarCreateForm = {
  title: string;
  description: string;
  eventType: CalendarEventType;
  date: string;
  startTime: string;
  endTime: string;
  meetingUrl: string;
  visibility: CalendarVisibility;
};

function toDateInputValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

function toTimeInputValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(11, 16);
}

function createInitialForm(): CalendarCreateForm {
  const template = getCalendarEventTemplate("brown_bag");
  const start = new Date();
  start.setHours(18, 0, 0, 0);
  const end = new Date(start.getTime() + template.durationMinutes * 60_000);
  return {
    title: template.title,
    description: template.description,
    eventType: "brown_bag",
    date: toDateInputValue(start),
    startTime: toTimeInputValue(start),
    endTime: toTimeInputValue(end),
    meetingUrl: "",
    visibility: template.visibility,
  };
}

function combineDateTime(date: string, time: string) {
  const combined = new Date(`${date}T${time}:00`);
  return Number.isNaN(combined.getTime()) ? null : combined.toISOString();
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatTimeRange(start: string, end: string) {
  const format = (value: string) =>
    new Date(value).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  return `${format(start)} - ${format(end)}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthLabel(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function CohortCalendarModule() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [token, setToken] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEventRecord[]>([]);
  const [view, setView] = useState<ViewMode>("agenda");
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventRecord | null>(null);
  const [form, setForm] = useState<CalendarCreateForm>(createInitialForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      const nextToken = data.session?.access_token ?? null;
      setToken(nextToken);
    };

    void loadSession();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextToken = session?.access_token ?? null;
      setToken(nextToken);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (
        event.origin === window.location.origin &&
        event.data?.type === "portal-auth-token" &&
        typeof event.data?.token === "string"
      ) {
        setToken(event.data.token);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (!token) {
      setEvents([]);
      return;
    }
    void loadEvents(token);
  }, [token]);

  async function loadEvents(activeToken: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/modules/cohort-calendar/events", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      const json = (await res.json().catch(() => [])) as
        | CalendarEventRecord[]
        | { error?: string };
      if (!res.ok) {
        throw new Error(
          Array.isArray(json) ? "Failed to load calendar events." : json.error,
        );
      }
      const nextEvents = Array.isArray(json) ? json : [];
      setEvents(nextEvents);
      setSelectedEvent((current) =>
        current ? nextEvents.find((event) => event.id === current.id) ?? current : null,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load calendar events.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  async function authedJson<T>(path: string, init?: RequestInit): Promise<T> {
    if (!token) throw new Error("Authentication required.");
    const res = await fetch(path, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const json = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) {
      throw new Error(json.error ?? `Request failed (${res.status})`);
    }
    return json;
  }

  async function submitCreate(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const startTime = combineDateTime(form.date, form.startTime);
      const endTime = combineDateTime(form.date, form.endTime);
      if (!startTime || !endTime) {
        throw new Error("Choose a valid date and time range.");
      }

      await authedJson<{ event: CalendarEventRecord }>(
        "/api/modules/cohort-calendar/events",
        {
          method: "POST",
          body: JSON.stringify({
            title: form.title,
            description: form.description,
            eventType: form.eventType,
            startTime,
            endTime,
            meetingUrl: form.meetingUrl || null,
            visibility: form.visibility,
            status: "scheduled",
          }),
        },
      );
      setForm(createInitialForm());
      setMessage("Event created.");
      if (token) {
        await loadEvents(token);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event.");
    } finally {
      setSaving(false);
    }
  }

  async function updateRsvp(status: CalendarAttendeeStatus) {
    if (!selectedEvent) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await authedJson(`/api/modules/cohort-calendar/events/${selectedEvent.id}/rsvp`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      setMessage("RSVP updated.");
      if (token) {
        await loadEvents(token);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update RSVP.");
    } finally {
      setSaving(false);
    }
  }

  async function downloadIcs(event: CalendarEventRecord) {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/modules/cohort-calendar/events/${event.id}/ics`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? "Failed to download ICS.");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "event"}.ics`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download ICS.");
    } finally {
      setSaving(false);
    }
  }

  function applyTemplate(eventType: CalendarEventType) {
    const template = getCalendarEventTemplate(eventType);
    const start = combineDateTime(form.date, form.startTime);
    const base = start ? new Date(start) : new Date();
    const end = new Date(base.getTime() + template.durationMinutes * 60_000);
    setForm((current) => ({
      ...current,
      eventType,
      title: template.title,
      description: template.description,
      endTime: toTimeInputValue(end),
      visibility: template.visibility,
    }));
  }

  const nextEvent = events.find((event) => new Date(event.endTime) >= new Date()) ?? null;
  const agendaEvents = [...events].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );
  const currentMonth = monthCursor.getMonth();
  const currentYear = monthCursor.getFullYear();
  const monthEvents = agendaEvents.filter((event) => {
    const start = new Date(event.startTime);
    return start.getMonth() === currentMonth && start.getFullYear() === currentYear;
  });

  const monthStart = startOfMonth(monthCursor);
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(monthStart.getDate() - monthStart.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    const items = monthEvents.filter((event) => {
      const start = new Date(event.startTime);
      return (
        start.getDate() === date.getDate() &&
        start.getMonth() === date.getMonth() &&
        start.getFullYear() === date.getFullYear()
      );
    });
    return { date, items };
  });

  if (!token) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Sign in to view the cohort calendar.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Next on deck
            </div>
            {nextEvent ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${CALENDAR_EVENT_TYPE_META[nextEvent.eventType].badgeClassName}`}
                  >
                    {CALENDAR_EVENT_TYPE_META[nextEvent.eventType].label}
                  </span>
                  {nextEvent.organizer?.isHost ? (
                    <span className="inline-flex rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
                      Host
                    </span>
                  ) : null}
                  <span className="text-sm text-muted-foreground">
                    {formatDate(nextEvent.startTime)}
                  </span>
                </div>
                <h2 className="text-2xl font-semibold">{nextEvent.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {formatTimeRange(nextEvent.startTime, nextEvent.endTime)}
                </p>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                No upcoming events scheduled.
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setView("agenda")}
              className={`rounded-full px-3 py-1.5 text-sm ${
                view === "agenda"
                  ? "bg-foreground text-background"
                  : "border border-border text-muted-foreground"
              }`}
            >
              Agenda
            </button>
            <button
              type="button"
              onClick={() => setView("month")}
              className={`rounded-full px-3 py-1.5 text-sm ${
                view === "month"
                  ? "bg-foreground text-background"
                  : "border border-border text-muted-foreground"
              }`}
            >
              Month
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
        <section className="space-y-4">
          {view === "agenda" ? (
            <div className="space-y-3">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading events…</p>
              ) : agendaEvents.length ? (
                agendaEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setSelectedEvent(event)}
                    className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-foreground/20"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-2">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${CALENDAR_EVENT_TYPE_META[event.eventType].badgeClassName}`}
                        >
                          {CALENDAR_EVENT_TYPE_META[event.eventType].label}
                        </span>
                        <h3 className="text-lg font-semibold">{event.title}</h3>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(event.startTime)} •{" "}
                          {formatTimeRange(event.startTime, event.endTime)}
                        </div>
                        {event.organizer?.isHost ? (
                          <div className="text-xs font-medium uppercase tracking-wide text-amber-700">
                            Host event
                          </div>
                        ) : null}
                      </div>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div>
                          Host:{" "}
                          <span className="text-foreground">
                            {event.organizer?.displayName ||
                              event.organizer?.handle ||
                              "RaidGuild Core"}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {event.meetingUrl ? (
                            <a
                              href={event.meetingUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted"
                              onClick={(clickEvent) => clickEvent.stopPropagation()}
                            >
                              Join
                            </a>
                          ) : null}
                          <a
                            href={buildGoogleCalendarUrl(event)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted"
                            onClick={(clickEvent) => clickEvent.stopPropagation()}
                          >
                            Add to Calendar
                          </a>
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  No events yet.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() =>
                    setMonthCursor(
                      new Date(currentYear, currentMonth - 1, 1),
                    )
                  }
                  className="rounded-full border border-border px-3 py-1 text-sm hover:bg-muted"
                >
                  Prev
                </button>
                <div className="text-sm font-semibold">{monthLabel(monthCursor)}</div>
                <button
                  type="button"
                  onClick={() =>
                    setMonthCursor(
                      new Date(currentYear, currentMonth + 1, 1),
                    )
                  }
                  className="rounded-full border border-border px-3 py-1 text-sm hover:bg-muted"
                >
                  Next
                </button>
              </div>
              <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs uppercase tracking-wide text-muted-foreground">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day}>{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {days.map(({ date, items }) => {
                  const inMonth = date.getMonth() === currentMonth;
                  return (
                    <div
                      key={date.toISOString()}
                      className={`min-h-28 rounded-2xl border p-2 ${
                        inMonth
                          ? "border-border bg-background"
                          : "border-border/60 bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      <div className="mb-2 text-xs font-medium">{date.getDate()}</div>
                      <div className="space-y-1">
                        {items.slice(0, 2).map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSelectedEvent(item)}
                            className="block w-full rounded-xl border border-border px-2 py-1 text-left text-[11px] hover:bg-muted"
                          >
                            <div className="truncate font-medium">
                              {item.title}
                              {item.organizer?.isHost ? " [Host]" : ""}
                            </div>
                            <div className="truncate text-muted-foreground">
                              {new Date(item.startTime).toLocaleTimeString(undefined, {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </div>
                          </button>
                        ))}
                        {items.length > 2 ? (
                          <div className="px-2 text-[11px] text-muted-foreground">
                            +{items.length - 2} more
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <form
            onSubmit={submitCreate}
            className="rounded-2xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="mb-3 text-lg font-semibold">Create event</div>
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Event Type</span>
                <select
                  value={form.eventType}
                  onChange={(event) =>
                    applyTemplate(event.target.value as CalendarEventType)
                  }
                  className="w-full rounded-xl border border-border bg-background px-3 py-2"
                >
                  {CALENDAR_EVENT_TYPES.map((eventType) => (
                    <option key={eventType} value={eventType}>
                      {CALENDAR_EVENT_TYPE_META[eventType].label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Title</span>
                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                  className="w-full rounded-xl border border-border bg-background px-3 py-2"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-sm sm:col-span-3">
                  <span className="mb-1 block text-muted-foreground">Date</span>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, date: event.target.value }))
                    }
                    className="w-full rounded-xl border border-border bg-background px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-muted-foreground">Start</span>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        startTime: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-border bg-background px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-muted-foreground">End</span>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, endTime: event.target.value }))
                    }
                    className="w-full rounded-xl border border-border bg-background px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-muted-foreground">Visibility</span>
                  <select
                    value={form.visibility}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        visibility: event.target.value as CalendarVisibility,
                      }))
                    }
                    className="w-full rounded-xl border border-border bg-background px-3 py-2"
                  >
                    {CALENDAR_VISIBILITIES.map((visibility) => (
                      <option key={visibility} value={visibility}>
                        {visibility}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Meeting Link</span>
                <input
                  value={form.meetingUrl}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      meetingUrl: event.target.value,
                    }))
                  }
                  placeholder="https://zoom.us/..."
                  className="w-full rounded-xl border border-border bg-background px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Description</span>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-border bg-background px-3 py-2"
                />
              </label>
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
              >
                {saving ? "Saving..." : "Create Event"}
              </button>
            </div>
          </form>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-2 text-lg font-semibold">Visible audiences</div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border px-2 py-1">public</span>
              <span className="rounded-full border px-2 py-1">members</span>
              <span className="rounded-full border px-2 py-1">cohort</span>
            </div>
          </div>
        </aside>
      </div>

      {selectedEvent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-background p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${CALENDAR_EVENT_TYPE_META[selectedEvent.eventType].badgeClassName}`}
                >
                  {CALENDAR_EVENT_TYPE_META[selectedEvent.eventType].label}
                </span>
                {selectedEvent.organizer?.isHost ? (
                  <span className="inline-flex rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
                    Host
                  </span>
                ) : null}
                <h3 className="text-2xl font-semibold">{selectedEvent.title}</h3>
                <div className="text-sm text-muted-foreground">
                  {formatDate(selectedEvent.startTime)} •{" "}
                  {formatTimeRange(selectedEvent.startTime, selectedEvent.endTime)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="rounded-full border border-border px-3 py-1 text-sm hover:bg-muted"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-4">
                {selectedEvent.description ? (
                  <p className="text-sm text-muted-foreground">
                    {selectedEvent.description}
                  </p>
                ) : null}
                {selectedEvent.organizer ? (
                  <div>
                    <div className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Organizer
                    </div>
                    <ProfileIdentity
                      handle={selectedEvent.organizer.handle}
                      displayName={
                        selectedEvent.organizer.displayName ||
                        selectedEvent.organizer.handle
                      }
                      avatarUrl={selectedEvent.organizer.avatarUrl}
                    />
                  </div>
                ) : null}
                <div>
                  <div className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Attendees
                  </div>
                  {selectedEvent.attendees.length ? (
                    <div className="space-y-2">
                      {selectedEvent.attendees.map((attendee) => (
                        <div
                          key={`${attendee.userId}-${attendee.status}`}
                          className="flex items-center justify-between rounded-xl border border-border px-3 py-2"
                        >
                          <span className="text-sm">
                            {attendee.displayName || attendee.handle || attendee.userId}
                          </span>
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">
                            {attendee.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No RSVPs yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
                {selectedEvent.meetingUrl ? (
                  <a
                    href={selectedEvent.meetingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl bg-foreground px-4 py-2 text-center text-sm font-medium text-background"
                  >
                    Join Meeting
                  </a>
                ) : null}
                <a
                  href={buildGoogleCalendarUrl(selectedEvent)}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-xl border border-border px-4 py-2 text-center text-sm hover:bg-muted"
                >
                  Add to Google Calendar
                </a>
                <button
                  type="button"
                  onClick={() => void downloadIcs(selectedEvent)}
                  className="block w-full rounded-xl border border-border px-4 py-2 text-center text-sm hover:bg-muted"
                >
                  Download ICS
                </button>
                <div className="pt-2">
                  <div className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    RSVP
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {CALENDAR_ATTENDEE_STATUSES.map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => void updateRsvp(status)}
                        disabled={saving}
                        className="rounded-xl border border-border px-2 py-2 text-xs capitalize hover:bg-muted disabled:opacity-60"
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
