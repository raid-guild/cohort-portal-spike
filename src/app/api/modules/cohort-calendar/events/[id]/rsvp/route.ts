import { NextRequest } from "next/server";
import { CALENDAR_ATTENDEE_STATUSES } from "@/modules/cohort-calendar/shared";
import {
  asUntypedAdmin,
  jsonError,
  loadCalendarEvents,
  requireCalendarViewer,
} from "../../../lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type RsvpBody = {
  status?: unknown;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const viewer = await requireCalendarViewer(request);
  if ("error" in viewer) {
    return jsonError(viewer.error, viewer.status);
  }

  const { id } = await context.params;
  let body: RsvpBody;
  try {
    body = (await request.json()) as RsvpBody;
  } catch {
    return jsonError("Invalid JSON.", 400);
  }

  const status = typeof body.status === "string" ? body.status : null;
  if (!status || !CALENDAR_ATTENDEE_STATUSES.includes(status as never)) {
    return jsonError("status is invalid.", 400);
  }

  const admin = asUntypedAdmin(viewer.admin);
  const events = await loadCalendarEvents(admin, viewer, { limit: 250 });
  const event = events.find((item) => item.id === id);
  if (!event) {
    return jsonError("Event not found.", 404);
  }

  const { error } = await admin.from("calendar_event_attendees").upsert(
    {
      event_id: id,
      user_id: viewer.userId,
      status,
    },
    { onConflict: "event_id,user_id" },
  );

  if (error) {
    return jsonError(error.message, 500);
  }

  return Response.json({ ok: true });
}
