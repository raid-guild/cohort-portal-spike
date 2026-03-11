import { beforeEach, describe, expect, it, vi } from "vitest";

const requireCalendarViewer = vi.fn();
const asUntypedAdmin = vi.fn();
const loadCalendarEvents = vi.fn();

vi.mock("../lib", () => ({
  requireCalendarViewer,
  asUntypedAdmin,
  loadCalendarEvents,
  jsonError: (message: string, status = 400) =>
    Response.json({ error: message }, { status }),
}));

describe("cohort calendar summary route", () => {
  beforeEach(() => {
    requireCalendarViewer.mockReset();
    asUntypedAdmin.mockReset();
    loadCalendarEvents.mockReset();
  });

  it("returns the next upcoming event", async () => {
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
        title: "Agent Automation",
        eventType: "cohort_session",
        startTime: "2026-03-16T17:30:00.000Z",
        endTime: "2026-03-16T19:00:00.000Z",
        status: "scheduled",
      },
    ]);

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/modules/cohort-calendar/summary") as never,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      title: "Next Event",
      items: [
        { label: "Type", value: "Cohort Session" },
        { label: "Title", value: "Agent Automation" },
        { label: "When", value: expect.any(String) },
      ],
    });
  });
});
