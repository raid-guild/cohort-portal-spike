import { NextRequest } from "next/server";
import {
  CALENDAR_EVENT_TYPES,
  CALENDAR_STATUSES,
  CALENDAR_VISIBILITIES,
} from "@/modules/cohort-calendar/shared";
import {
  asUntypedAdmin,
  isHost,
  jsonError,
  loadCalendarEvents,
  requireCalendarViewer,
} from "../lib";

type CreateCalendarEventBody = {
  title?: unknown;
  description?: unknown;
  eventType?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  meetingUrl?: unknown;
  visibility?: unknown;
  status?: unknown;
};

function asTrimmed(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function asIsoString(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export async function GET(request: NextRequest) {
  const viewer = await requireCalendarViewer(request);
  if ("error" in viewer) {
    return jsonError(viewer.error, viewer.status);
  }

  try {
    const events = await loadCalendarEvents(asUntypedAdmin(viewer.admin), viewer);
    return Response.json(events);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to load calendar events.",
      500,
    );
  }
}

export async function POST(request: NextRequest) {
  const viewer = await requireCalendarViewer(request);
  if ("error" in viewer) {
    return jsonError(viewer.error, viewer.status);
  }
  if (!isHost(viewer)) {
    return jsonError("Host access required.", 403);
  }

  let body: CreateCalendarEventBody;
  try {
    body = (await request.json()) as CreateCalendarEventBody;
  } catch {
    return jsonError("Invalid JSON.", 400);
  }

  const title = asTrimmed(body.title);
  const eventType = typeof body.eventType === "string" ? body.eventType : null;
  const startTime = asIsoString(body.startTime);
  const endTime = asIsoString(body.endTime);
  const description = asTrimmed(body.description);
  const meetingUrl = asTrimmed(body.meetingUrl);
  const visibility =
    typeof body.visibility === "string" ? body.visibility : "public";
  const status = typeof body.status === "string" ? body.status : "scheduled";

  if (!title) {
    return jsonError("title is required.", 400);
  }
  if (!eventType || !CALENDAR_EVENT_TYPES.includes(eventType as never)) {
    return jsonError("eventType is invalid.", 400);
  }
  if (!startTime || !endTime) {
    return jsonError("startTime and endTime must be valid ISO datetimes.", 400);
  }
  if (new Date(endTime) <= new Date(startTime)) {
    return jsonError("endTime must be later than startTime.", 400);
  }
  if (!CALENDAR_VISIBILITIES.includes(visibility as never)) {
    return jsonError("visibility is invalid.", 400);
  }
  if (!CALENDAR_STATUSES.includes(status as never)) {
    return jsonError("status is invalid.", 400);
  }
  if (meetingUrl) {
    try {
      const parsed = new URL(meetingUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return jsonError("meetingUrl must use http or https.", 400);
      }
    } catch {
      return jsonError("meetingUrl must be a valid URL.", 400);
    }
  }

  const admin = asUntypedAdmin(viewer.admin);
  const insertRes = await admin
    .from("calendar_events")
    .insert({
      title,
      description,
      event_type: eventType,
      start_time: startTime,
      end_time: endTime,
      meeting_url: meetingUrl,
      created_by: viewer.userId,
      visibility,
      status,
    })
    .select(
      "id,title,description,event_type,start_time,end_time,meeting_url,created_by,visibility,status,created_at,updated_at",
    )
    .single();

  if (insertRes.error) {
    return jsonError(insertRes.error.message, 500);
  }

  try {
    const events = await loadCalendarEvents(admin, viewer, { limit: 250 });
    const event = events.find((item) => item.id === (insertRes.data as { id: string }).id);
    return Response.json({ event: event ?? insertRes.data }, { status: 201 });
  } catch {
    return Response.json({ event: insertRes.data }, { status: 201 });
  }
}
