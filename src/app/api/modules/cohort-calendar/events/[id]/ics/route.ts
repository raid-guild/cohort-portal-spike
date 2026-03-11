import { NextRequest } from "next/server";
import { buildCalendarEventIcs } from "@/modules/cohort-calendar/shared";
import {
  asUntypedAdmin,
  jsonError,
  loadCalendarEvents,
  requireCalendarViewer,
} from "../../../lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const viewer = await requireCalendarViewer(request);
  if ("error" in viewer) {
    return jsonError(viewer.error, viewer.status);
  }

  const { id } = await context.params;
  try {
    const events = await loadCalendarEvents(asUntypedAdmin(viewer.admin), viewer, {
      limit: 250,
    });
    const event = events.find((item) => item.id === id);
    if (!event) {
      return jsonError("Event not found.", 404);
    }

    const filename = `${event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "event"}.ics`;
    const body = buildCalendarEventIcs(event);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to export calendar event.",
      500,
    );
  }
}
