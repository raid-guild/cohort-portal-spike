import { beforeEach, describe, expect, it, vi } from "vitest";

const requireCalendarViewer = vi.fn();
const isHost = vi.fn();
const asUntypedAdmin = vi.fn();
const loadCalendarEvents = vi.fn();

vi.mock("../lib", () => ({
  requireCalendarViewer,
  isHost,
  asUntypedAdmin,
  loadCalendarEvents,
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
});
