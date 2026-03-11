import { beforeEach, describe, expect, it, vi } from "vitest";

const requireCalendarViewer = vi.fn();
const isHost = vi.fn();
const asUntypedAdmin = vi.fn();
const loadCalendarEvents = vi.fn();
const toCalendarEventRecord = vi.fn((row: Record<string, unknown>) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  eventType: row.event_type,
  startTime: row.start_time,
  endTime: row.end_time,
  meetingUrl: row.meeting_url,
  createdBy: row.created_by,
  visibility: row.visibility,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  organizer: null,
  attendees: [],
}));

vi.mock("../lib", () => ({
  requireCalendarViewer,
  isHost,
  asUntypedAdmin,
  loadCalendarEvents,
  toCalendarEventRecord,
  jsonError: (message: string, status = 400) =>
    Response.json({ error: message }, { status }),
}));

function makeInsertAdmin() {
  return {
    from: (table: string) => {
      if (table !== "calendar_events") {
        throw new Error(`Unexpected table: ${table}`);
      }
      return {
        insert: () => ({
          select: () => ({
            single: vi.fn().mockResolvedValue({
              data: {
                id: "event-1",
                title: "Cohort Session",
                description: "Official cohort session",
                event_type: "cohort_session",
                start_time: "2026-03-20T17:00:00.000Z",
                end_time: "2026-03-20T18:30:00.000Z",
                meeting_url: "https://zoom.us/j/raidguild",
                created_by: "host-1",
                visibility: "cohort",
                status: "scheduled",
                created_at: "2026-03-11T00:00:00.000Z",
                updated_at: "2026-03-11T00:00:00.000Z",
              },
              error: null,
            }),
          }),
        }),
      };
    },
  };
}

describe("cohort calendar events route", () => {
  beforeEach(() => {
    requireCalendarViewer.mockReset();
    isHost.mockReset();
    asUntypedAdmin.mockReset();
    loadCalendarEvents.mockReset();
    toCalendarEventRecord.mockClear();
  });

  it("returns calendar events for authenticated viewers", async () => {
    requireCalendarViewer.mockResolvedValue({
      userId: "user-1",
      roles: [],
      entitlements: [],
      admin: {},
    });
    asUntypedAdmin.mockReturnValue({});
    loadCalendarEvents.mockResolvedValue([{ id: "event-1", title: "Brown Bag" }]);

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/modules/cohort-calendar/events") as never,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: "event-1", title: "Brown Bag" }]);
  });

  it("rejects non-host event creation", async () => {
    requireCalendarViewer.mockResolvedValue({
      userId: "user-1",
      roles: [],
      entitlements: [],
      admin: {},
    });
    isHost.mockReturnValue(false);

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/modules/cohort-calendar/events", {
        method: "POST",
        body: JSON.stringify({
          title: "Cohort Session",
          eventType: "cohort_session",
          startTime: "2026-03-20T17:00:00.000Z",
          endTime: "2026-03-20T18:30:00.000Z",
        }),
      }) as never,
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Host access required." });
  });

  it("creates events for host users", async () => {
    const admin = makeInsertAdmin();
    requireCalendarViewer.mockResolvedValue({
      userId: "host-1",
      roles: ["host"],
      entitlements: [],
      admin: {},
    });
    isHost.mockReturnValue(true);
    asUntypedAdmin.mockReturnValue(admin);
    loadCalendarEvents.mockResolvedValue([
      {
        id: "event-1",
        title: "Cohort Session",
        eventType: "cohort_session",
      },
    ]);

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/modules/cohort-calendar/events", {
        method: "POST",
        body: JSON.stringify({
          title: "Cohort Session",
          description: "Official cohort session",
          eventType: "cohort_session",
          startTime: "2026-03-20T17:00:00.000Z",
          endTime: "2026-03-20T18:30:00.000Z",
          meetingUrl: "https://zoom.us/j/raidguild",
          visibility: "cohort",
          status: "scheduled",
        }),
      }) as never,
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      event: expect.objectContaining({ id: "event-1", title: "Cohort Session" }),
    });
  });

  it("returns a camelCase event payload when the reload path fails", async () => {
    const admin = makeInsertAdmin();
    requireCalendarViewer.mockResolvedValue({
      userId: "host-1",
      roles: ["host"],
      entitlements: [],
      admin: {},
    });
    isHost.mockReturnValue(true);
    asUntypedAdmin.mockReturnValue(admin);
    loadCalendarEvents.mockRejectedValue(new Error("reload failed"));

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/modules/cohort-calendar/events", {
        method: "POST",
        body: JSON.stringify({
          title: "Cohort Session",
          eventType: "cohort_session",
          startTime: "2026-03-20T17:00:00.000Z",
          endTime: "2026-03-20T18:30:00.000Z",
        }),
      }) as never,
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      event: {
        id: "event-1",
        title: "Cohort Session",
        description: "Official cohort session",
        eventType: "cohort_session",
        startTime: "2026-03-20T17:00:00.000Z",
        endTime: "2026-03-20T18:30:00.000Z",
        meetingUrl: "https://zoom.us/j/raidguild",
        createdBy: "host-1",
        visibility: "cohort",
        status: "scheduled",
        createdAt: "2026-03-11T00:00:00.000Z",
        updatedAt: "2026-03-11T00:00:00.000Z",
        organizer: null,
        attendees: [],
      },
    });
  });
});
