import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePollViewer = vi.fn();
const asUntypedAdmin = vi.fn();
const isHost = vi.fn();
const emitPortalEvent = vi.fn();

vi.mock("../../lib", () => ({
  requirePollViewer,
  asUntypedAdmin,
  isHost,
  jsonError: (message: string, status = 400) => Response.json({ error: message }, { status }),
}));

vi.mock("@/lib/portal-events", () => ({
  emitPortalEvent,
}));

function makeCloseAdmin({ poll, updatedPoll }: { poll: Record<string, unknown> | null; updatedPoll?: Record<string, unknown> }) {
  return {
    from: (table: string) => {
      if (table !== "polls") throw new Error(`Unexpected table: ${table}`);
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: poll, error: null }),
          }),
          single: vi.fn().mockResolvedValue({ data: updatedPoll ?? poll, error: null }),
        }),
        update: () => ({
          eq: () => ({
            select: () => ({
              single: vi.fn().mockResolvedValue({ data: updatedPoll ?? poll, error: null }),
            }),
          }),
        }),
      };
    },
  };
}

describe("polling close route", () => {
  beforeEach(() => {
    requirePollViewer.mockReset();
    asUntypedAdmin.mockReset();
    isHost.mockReset();
    emitPortalEvent.mockReset();
  });

  it("allows host users to close polls", async () => {
    requirePollViewer.mockResolvedValue({ userId: "host-1", roles: ["host"], entitlements: [], admin: {} });
    asUntypedAdmin.mockReturnValue(
      makeCloseAdmin({
        poll: {
          id: "poll-1",
          created_by: "creator-1",
          status: "open",
        },
        updatedPoll: {
          id: "poll-1",
          created_by: "creator-1",
          status: "closed",
        },
      }),
    );
    isHost.mockReturnValue(true);
    emitPortalEvent.mockResolvedValue({ ok: true });

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/modules/polling/poll-1/close", {
      method: "POST",
    });

    const res = await POST(req as never, { params: Promise.resolve({ id: "poll-1" }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      poll: expect.objectContaining({ id: "poll-1", status: "closed" }),
    });
  });

  it("denies non-host non-owner users", async () => {
    requirePollViewer.mockResolvedValue({ userId: "member-1", roles: [], entitlements: [], admin: {} });
    asUntypedAdmin.mockReturnValue(
      makeCloseAdmin({
        poll: {
          id: "poll-1",
          created_by: "creator-1",
          status: "open",
        },
      }),
    );
    isHost.mockReturnValue(false);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/modules/polling/poll-1/close", {
      method: "POST",
    });

    const res = await POST(req as never, { params: Promise.resolve({ id: "poll-1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 409 when poll is already closed", async () => {
    requirePollViewer.mockResolvedValue({ userId: "creator-1", roles: [], entitlements: [], admin: {} });
    asUntypedAdmin.mockReturnValue(
      makeCloseAdmin({
        poll: {
          id: "poll-1",
          created_by: "creator-1",
          status: "closed",
        },
      }),
    );
    isHost.mockReturnValue(false);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/modules/polling/poll-1/close", {
      method: "POST",
    });

    const res = await POST(req as never, { params: Promise.resolve({ id: "poll-1" }) });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Poll is already closed." });
  });
});
