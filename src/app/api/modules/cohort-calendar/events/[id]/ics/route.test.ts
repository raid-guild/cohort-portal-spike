import { beforeEach, describe, expect, it, vi } from "vitest";

const requireCalendarViewer = vi.fn();
const asUntypedAdmin = vi.fn();
const loadCalendarEvents = vi.fn();

vi.mock("../../../lib", () => ({
  requireCalendarViewer,
  asUntypedAdmin,
  loadCalendarEvents,
  jsonError: (message: string, status = 400) =>
    Response.json({ error: message }, { status }),
}));

describe("cohort calendar ics route", () => {
  beforeEach(() => {
    requireCalendarViewer.mockReset();
    asUntypedAdmin.mockReset();
    loadCalendarEvents.mockReset();
  });

  it("returns an ics file for a visible event", async () => {
    requireCalendarViewer.mockResolvedValue({
      userId: "user-1",
      roles: [],
      entitlements: [],
      admin: {},
    });
    asUntypedAdmin.mockReturnValue({});
    loadCalendarEvents.mockResolvedValue([
      {
        id: "event-1",
        title: "Weekly Guild Sync",
        description: "Open community sync",
        eventType: "community_call",
        startTime: "2026-03-18T18:00:00.000Z",
        endTime: "2026-03-18T19:00:00.000Z",
        meetingUrl: "https://meet.google.com/raid-guild-sync",
      },
    ]);

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/modules/cohort-calendar/events/event-1/ics") as never,
      { params: Promise.resolve({ id: "event-1" }) },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/calendar");
    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("SUMMARY:Weekly Guild Sync");
  });
});
