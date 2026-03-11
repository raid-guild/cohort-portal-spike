import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseAdminClient = vi.fn();
const supabaseServerClient = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdminClient,
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServerClient,
}));

describe("cohort calendar lib", () => {
  beforeEach(() => {
    supabaseAdminClient.mockReset();
    supabaseServerClient.mockReset();
  });

  it("fails closed when role lookups error", async () => {
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "user_roles") {
          return {
            select: () => ({
              eq: () =>
                Promise.resolve({
                  data: null,
                  error: { message: "roles offline" },
                }),
            }),
          };
        }

        if (table === "entitlements") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  or: () =>
                    Promise.resolve({
                      data: [{ entitlement: "cohort-access" }],
                      error: null,
                    }),
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    supabaseAdminClient.mockReturnValue(admin);
    supabaseServerClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    });

    const { requireCalendarViewer } = await import("./lib");
    const result = await requireCalendarViewer(
      new Request("http://localhost", {
        headers: { Authorization: "Bearer token-1" },
      }) as never,
    );

    expect(result).toEqual({
      error: "Failed to load calendar access.",
      status: 500,
    });
  });

  it("applies the viewer limit after visibility filtering", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve(
          resolve({
            data: [
              {
                id: "hidden-1",
                title: "Hidden",
                description: null,
                event_type: "cohort_session",
                start_time: "2026-03-10T17:00:00.000Z",
                end_time: "2026-03-10T18:00:00.000Z",
                meeting_url: null,
                created_by: "host-1",
                visibility: "cohort",
                status: "scheduled",
                created_at: "2026-03-01T00:00:00.000Z",
                updated_at: "2026-03-01T00:00:00.000Z",
              },
              {
                id: "visible-1",
                title: "Visible",
                description: null,
                event_type: "brown_bag",
                start_time: "2026-03-11T17:00:00.000Z",
                end_time: "2026-03-11T18:00:00.000Z",
                meeting_url: null,
                created_by: "host-1",
                visibility: "public",
                status: "scheduled",
                created_at: "2026-03-01T00:00:00.000Z",
                updated_at: "2026-03-01T00:00:00.000Z",
              },
            ],
            error: null,
          }),
        ),
    };

    const admin = {
      from: vi.fn((table: string) => {
        if (table === "calendar_events") {
          return query;
        }

        if (table === "profiles" || table === "calendar_event_attendees") {
          return {
            select: () => ({
              in: () => Promise.resolve({ data: [], error: null }),
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const { loadCalendarEvents } = await import("./lib");
    const result = await loadCalendarEvents(
      admin as never,
      {
        userId: "user-1",
        roles: [],
        entitlements: [],
        admin: {} as never,
      },
      { limit: 1 },
    );

    expect(query.limit).toHaveBeenCalledWith(1000);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: "visible-1",
        title: "Visible",
        eventType: "brown_bag",
      }),
    );
  });
});
