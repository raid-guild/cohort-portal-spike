import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePollViewer = vi.fn();
const asUntypedAdmin = vi.fn();
const evaluateEligibility = vi.fn();
const parseRule = vi.fn();

vi.mock("./lib", () => ({
  requirePollViewer,
  asUntypedAdmin,
  evaluateEligibility,
  parseRule,
  parseLimit: () => 20,
  asIsoDate: (value: unknown) => (typeof value === "string" ? value : null),
  stateForPoll: () => "open",
  jsonError: (message: string, status = 400) => Response.json({ error: message }, { status }),
}));

vi.mock("@/lib/portal-events", () => ({
  emitPortalEvent: vi.fn(),
}));

describe("polling create route", () => {
  beforeEach(() => {
    requirePollViewer.mockReset();
    asUntypedAdmin.mockReset();
    evaluateEligibility.mockReset();
    parseRule.mockReset();
  });

  it("rejects invalid eligibility_rules entries", async () => {
    requirePollViewer.mockResolvedValue({ userId: "user-1", roles: [], entitlements: [], admin: {} });
    parseRule.mockReturnValue(null);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/modules/polling", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "New Poll",
        opens_at: "2026-02-28T00:00:00.000Z",
        closes_at: "2026-03-01T00:00:00.000Z",
        options: [{ label: "A" }, { label: "B" }],
        eligibility_rules: [{ action: "vote", rule_type: "role" }],
      }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "One or more eligibility_rules are invalid." });
  });
});
