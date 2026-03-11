import { NextRequest } from "next/server";
import { CALENDAR_EVENT_TYPE_META } from "@/modules/cohort-calendar/shared";
import {
  asUntypedAdmin,
  jsonError,
  loadCalendarEvents,
  requireCalendarViewer,
} from "../lib";

export async function GET(request: NextRequest) {
  const viewer = await requireCalendarViewer(request);
  if ("error" in viewer) {
    return jsonError(viewer.error, viewer.status);
  }

  try {
    const events = await loadCalendarEvents(asUntypedAdmin(viewer.admin), viewer, {
      upcomingOnly: true,
      limit: 50,
    });
    const nextEvent = events.find((event) => event.status === "scheduled") ?? null;

    if (!nextEvent) {
      return Response.json({
        title: "Next Event",
        items: [{ label: "Status", value: "No upcoming sessions" }],
      });
    }

    const start = new Date(nextEvent.startTime);
    const day = start.toLocaleDateString(undefined, { weekday: "long" });
    const time = start.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });

    return Response.json({
      title: "Next Event",
      items: [
        { label: "Type", value: CALENDAR_EVENT_TYPE_META[nextEvent.eventType].label },
        { label: "Title", value: nextEvent.title },
        { label: "When", value: `${day} • ${time}` },
      ],
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to load calendar summary.",
      500,
    );
  }
}
