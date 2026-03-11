import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePollViewer = vi.fn();
const asUntypedAdmin = vi.fn();
const evaluateEligibility = vi.fn();
const stateForPoll = vi.fn();
const loadPollProfileMap = vi.fn();

vi.mock("../lib", () => ({
  requirePollViewer,
  asUntypedAdmin,
  evaluateEligibility,
  stateForPoll,
  loadPollProfileMap,
  summarizePollCounts: (options: Array<{ id: string }>, votes: Array<{ option_id: string }>) => {
    const counts = new Map<string, number>();
    for (const option of options) counts.set(option.id, 0);
    for (const vote of votes) counts.set(vote.option_id, (counts.get(vote.option_id) ?? 0) + 1);
    return counts;
  },
  jsonError: (message: string, status = 400) => Response.json({ error: message }, { status }),
}));

function makeDetailAdmin() {
  let pollVotesEqCall = 0;

  return {
    from: (table: string) => {
      if (table === "polls") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "poll-1",
                  title: "Test poll",
                  description: null,
                  created_by: "creator-1",
                  opens_at: "2026-02-27T00:00:00.000Z",
                  closes_at: "2026-03-01T00:00:00.000Z",
                  status: "open",
                  allow_vote_change: false,
                  results_visibility: "after_close",
                },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "poll_eligibility_rules") {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [{ action: "view_results", rule_type: "authenticated", rule_value: null }], error: null }),
          }),
        };
      }

      if (table === "poll_options") {
        return {
          select: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({
                  data: [{ id: "option-1", poll_id: "poll-1", label: "A", subject_user_id: null, sort_order: 0, metadata: {}, created_at: "2026-02-28T00:00:00.000Z" }],
                  error: null,
                }),
            }),
          }),
        };
      }

      if (table === "poll_votes") {
        return {
          select: () => ({
            eq: () => {
              pollVotesEqCall += 1;
              if (pollVotesEqCall === 1) {
                return Promise.resolve({
                  data: [
                    {
                      id: "vote-1",
                      poll_id: "poll-1",
                      option_id: "option-1",
                      voter_user_id: "user-2",
                      created_at: "2026-02-28T00:00:00.000Z",
                      updated_at: "2026-02-28T00:00:00.000Z",
                    },
                  ],
                  error: null,
                });
              }
              return {
                eq: () => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              };
            },
          }),
        };
      }

      throw new Error(`Unhandled table: ${table}`);
    },
  };
}

describe("polling detail route", () => {
  beforeEach(() => {
    requirePollViewer.mockReset();
    asUntypedAdmin.mockReset();
    evaluateEligibility.mockReset();
    stateForPoll.mockReset();
    loadPollProfileMap.mockReset();
  });

  it("hides totals and option counts until results are visible", async () => {
    requirePollViewer.mockResolvedValue({ userId: "user-1", roles: [], entitlements: [], admin: {} });
    asUntypedAdmin.mockReturnValue(makeDetailAdmin());
    stateForPoll.mockReturnValue("open");
    evaluateEligibility.mockImplementation((action: string) => action === "view_results");
    loadPollProfileMap.mockResolvedValue(new Map());

    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/modules/polling/poll-1");
    const res = await GET(req as never, { params: Promise.resolve({ id: "poll-1" }) });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect((body.poll as { totals: { total_votes: number | null } }).totals.total_votes).toBeNull();
    expect((body.options as Array<{ votes_count: number | null }>)[0]?.votes_count).toBeNull();
    expect((body.poll as { results_visible: boolean }).results_visible).toBe(false);
  });
});
