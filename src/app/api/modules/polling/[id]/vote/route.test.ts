import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePollViewer = vi.fn();
const asUntypedAdmin = vi.fn();
const evaluateEligibility = vi.fn();
const stateForPoll = vi.fn();
const emitPortalEvent = vi.fn();

vi.mock("../../lib", () => ({
  requirePollViewer,
  asUntypedAdmin,
  evaluateEligibility,
  stateForPoll,
  jsonError: (message: string, status = 400) => Response.json({ error: message }, { status }),
}));

vi.mock("@/lib/portal-events", () => ({
  emitPortalEvent,
}));

type VoteConfig = {
  poll: Record<string, unknown> | null;
  rules: Array<Record<string, unknown>>;
  optionExists: boolean;
  existingVote: Record<string, unknown> | null;
  insertVote?: Record<string, unknown>;
  updateVote?: Record<string, unknown>;
  insertError?: { message: string; code?: string } | null;
  updateError?: { message: string; code?: string } | null;
};

function makeVoteAdmin(config: VoteConfig) {
  return {
    from: (table: string) => {
      if (table === "polls") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: config.poll, error: null }),
            }),
          }),
        };
      }

      if (table === "poll_eligibility_rules") {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: config.rules, error: null }),
          }),
        };
      }

      if (table === "poll_options") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: config.optionExists ? { id: "option-1", poll_id: "poll-1" } : null,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === "poll_votes") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: config.existingVote, error: null }),
              }),
            }),
            single: vi.fn().mockResolvedValue({ data: config.insertVote ?? null, error: null }),
          }),
          insert: () => ({
            select: () => ({
              single: vi
                .fn()
                .mockResolvedValue({ data: config.insertVote ?? null, error: config.insertError ?? null }),
            }),
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                single: vi
                  .fn()
                  .mockResolvedValue({ data: config.updateVote ?? null, error: config.updateError ?? null }),
              }),
            }),
          }),
        };
      }

      throw new Error(`Unhandled table mock: ${table}`);
    },
  };
}

describe("polling vote route", () => {
  beforeEach(() => {
    requirePollViewer.mockReset();
    asUntypedAdmin.mockReset();
    evaluateEligibility.mockReset();
    stateForPoll.mockReset();
    emitPortalEvent.mockReset();
  });

  it("allows eligible voter to cast a vote", async () => {
    requirePollViewer.mockResolvedValue({ userId: "user-1", roles: [], entitlements: ["dao-member"], admin: {} });
    asUntypedAdmin.mockReturnValue(
      makeVoteAdmin({
        poll: {
          id: "poll-1",
          created_by: "user-host",
          opens_at: "2026-02-27T00:00:00.000Z",
          closes_at: "2026-03-01T00:00:00.000Z",
          status: "open",
          allow_vote_change: false,
        },
        rules: [{ action: "vote", rule_type: "entitlement", rule_value: "dao-member" }],
        optionExists: true,
        existingVote: null,
        insertVote: {
          id: "vote-1",
          poll_id: "poll-1",
          option_id: "option-1",
          voter_user_id: "user-1",
          created_at: "2026-02-28T00:00:00.000Z",
          updated_at: "2026-02-28T00:00:00.000Z",
        },
      }),
    );
    stateForPoll.mockReturnValue("open");
    evaluateEligibility.mockReturnValue(true);
    emitPortalEvent.mockResolvedValue({ ok: true });

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/modules/polling/poll-1/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_id: "option-1" }),
    });

    const res = await POST(req as never, { params: Promise.resolve({ id: "poll-1" }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      vote: expect.objectContaining({ id: "vote-1", option_id: "option-1" }),
      changed: false,
    });
  });

  it("denies ineligible voters", async () => {
    requirePollViewer.mockResolvedValue({ userId: "user-2", roles: [], entitlements: [], admin: {} });
    asUntypedAdmin.mockReturnValue(
      makeVoteAdmin({
        poll: {
          id: "poll-1",
          status: "open",
          allow_vote_change: false,
        },
        rules: [{ action: "vote", rule_type: "entitlement", rule_value: "dao-member" }],
        optionExists: true,
        existingVote: null,
      }),
    );
    stateForPoll.mockReturnValue("open");
    evaluateEligibility.mockReturnValue(false);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/modules/polling/poll-1/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_id: "option-1" }),
    });

    const res = await POST(req as never, { params: Promise.resolve({ id: "poll-1" }) });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "You are not eligible to vote in this poll." });
  });

  it("denies duplicate vote when vote changes are disabled", async () => {
    requirePollViewer.mockResolvedValue({ userId: "user-1", roles: [], entitlements: ["dao-member"], admin: {} });
    asUntypedAdmin.mockReturnValue(
      makeVoteAdmin({
        poll: {
          id: "poll-1",
          status: "open",
          allow_vote_change: false,
        },
        rules: [{ action: "vote", rule_type: "authenticated", rule_value: null }],
        optionExists: true,
        existingVote: {
          id: "vote-1",
          poll_id: "poll-1",
          option_id: "option-0",
          voter_user_id: "user-1",
          created_at: "2026-02-28T00:00:00.000Z",
          updated_at: "2026-02-28T00:00:00.000Z",
        },
      }),
    );
    stateForPoll.mockReturnValue("open");
    evaluateEligibility.mockReturnValue(true);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/modules/polling/poll-1/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_id: "option-1" }),
    });

    const res = await POST(req as never, { params: Promise.resolve({ id: "poll-1" }) });
    expect(res.status).toBe(409);
  });

  it("allows vote changes when enabled", async () => {
    requirePollViewer.mockResolvedValue({ userId: "user-1", roles: [], entitlements: ["dao-member"], admin: {} });
    asUntypedAdmin.mockReturnValue(
      makeVoteAdmin({
        poll: {
          id: "poll-1",
          status: "open",
          allow_vote_change: true,
        },
        rules: [{ action: "vote", rule_type: "authenticated", rule_value: null }],
        optionExists: true,
        existingVote: {
          id: "vote-1",
          poll_id: "poll-1",
          option_id: "option-0",
          voter_user_id: "user-1",
          created_at: "2026-02-28T00:00:00.000Z",
          updated_at: "2026-02-28T00:00:00.000Z",
        },
        updateVote: {
          id: "vote-1",
          poll_id: "poll-1",
          option_id: "option-1",
          voter_user_id: "user-1",
          created_at: "2026-02-28T00:00:00.000Z",
          updated_at: "2026-02-28T01:00:00.000Z",
        },
      }),
    );
    stateForPoll.mockReturnValue("open");
    evaluateEligibility.mockReturnValue(true);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/modules/polling/poll-1/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_id: "option-1" }),
    });

    const res = await POST(req as never, { params: Promise.resolve({ id: "poll-1" }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      vote: expect.objectContaining({ id: "vote-1", option_id: "option-1" }),
      changed: true,
    });
  });

  it("denies votes when poll is closed", async () => {
    requirePollViewer.mockResolvedValue({ userId: "user-1", roles: [], entitlements: ["dao-member"], admin: {} });
    asUntypedAdmin.mockReturnValue(
      makeVoteAdmin({
        poll: {
          id: "poll-1",
          status: "closed",
          allow_vote_change: false,
        },
        rules: [{ action: "vote", rule_type: "authenticated", rule_value: null }],
        optionExists: true,
        existingVote: null,
      }),
    );
    stateForPoll.mockReturnValue("closed");
    evaluateEligibility.mockReturnValue(true);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/modules/polling/poll-1/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_id: "option-1" }),
    });

    const res = await POST(req as never, { params: Promise.resolve({ id: "poll-1" }) });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Poll is not open for voting." });
  });

  it("returns 409 when concurrent insert hits unique constraint", async () => {
    requirePollViewer.mockResolvedValue({ userId: "user-1", roles: [], entitlements: ["dao-member"], admin: {} });
    asUntypedAdmin.mockReturnValue(
      makeVoteAdmin({
        poll: {
          id: "poll-1",
          status: "open",
          allow_vote_change: false,
        },
        rules: [{ action: "vote", rule_type: "authenticated", rule_value: null }],
        optionExists: true,
        existingVote: null,
        insertError: { message: "duplicate key value violates unique constraint", code: "23505" },
      }),
    );
    stateForPoll.mockReturnValue("open");
    evaluateEligibility.mockReturnValue(true);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/modules/polling/poll-1/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_id: "option-1" }),
    });

    const res = await POST(req as never, { params: Promise.resolve({ id: "poll-1" }) });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Vote already exists." });
  });

  it("returns 400 for null JSON body", async () => {
    requirePollViewer.mockResolvedValue({ userId: "user-1", roles: [], entitlements: ["dao-member"], admin: {} });

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/modules/polling/poll-1/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "null",
    });

    const res = await POST(req as never, { params: Promise.resolve({ id: "poll-1" }) });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON." });
    expect(asUntypedAdmin).not.toHaveBeenCalled();
  });

  it("returns 409 when DB rejects vote because poll is no longer open", async () => {
    requirePollViewer.mockResolvedValue({ userId: "user-1", roles: [], entitlements: ["dao-member"], admin: {} });
    asUntypedAdmin.mockReturnValue(
      makeVoteAdmin({
        poll: {
          id: "poll-1",
          status: "open",
          allow_vote_change: false,
        },
        rules: [{ action: "vote", rule_type: "authenticated", rule_value: null }],
        optionExists: true,
        existingVote: null,
        insertError: { message: "Poll is not open for voting.", code: "23514" },
      }),
    );
    stateForPoll.mockReturnValue("open");
    evaluateEligibility.mockReturnValue(true);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/modules/polling/poll-1/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_id: "option-1" }),
    });

    const res = await POST(req as never, { params: Promise.resolve({ id: "poll-1" }) });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Poll is not open for voting." });
  });
});
