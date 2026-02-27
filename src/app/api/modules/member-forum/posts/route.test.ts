import { beforeEach, describe, expect, it, vi } from "vitest";

const getViewer = vi.fn();
const getVisibleSpaces = vi.fn();
const canWriteSpace = vi.fn();
const sanitizePostForResponse = vi.fn((post) => post);
const emitPortalEvent = vi.fn();

vi.mock("@/app/api/modules/member-forum/lib", () => ({
  asUntypedAdmin: () => ({
    from: () => {
      const chain = {
        insert: () => chain,
        select: () => chain,
        single: vi.fn().mockResolvedValue({
          data: {
            id: "forum-post-1",
            space_id: "space-1",
            author_id: "user-1",
            title: "First Post",
            body_md: "hello",
            is_locked: false,
            is_deleted: false,
            created_at: "2026-02-27T00:00:00.000Z",
            updated_at: "2026-02-27T00:00:00.000Z",
          },
          error: null,
        }),
      };
      return chain;
    },
  }),
  canWriteSpace,
  getViewer,
  getVisibleSpaces,
  jsonError: (message: string, status = 400) => Response.json({ error: message }, { status }),
  sanitizePostForResponse,
}));

vi.mock("@/lib/portal-events", () => ({
  emitPortalEvent,
}));

describe("member-forum post create route", () => {
  beforeEach(() => {
    getViewer.mockReset();
    getVisibleSpaces.mockReset();
    canWriteSpace.mockReset();
    sanitizePostForResponse.mockClear();
    emitPortalEvent.mockReset();
  });

  it("emits post_created event and keeps response shape", async () => {
    getViewer.mockResolvedValue({ userId: "user-1", admin: {} });
    getVisibleSpaces.mockResolvedValue([
      { id: "space-1", slug: "general", name: "General" },
    ]);
    canWriteSpace.mockReturnValue(true);
    emitPortalEvent.mockResolvedValue({ ok: true });

    const { POST } = await import("./route");
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        space_slug: "general",
        title: "First Post",
        body_md: "hello",
      }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      post: expect.objectContaining({
        id: "forum-post-1",
        space: expect.objectContaining({ slug: "general" }),
      }),
    });
    expect(emitPortalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleId: "member-forum",
        kind: "core.member_forum.post_created",
        dedupeKey: "forum_post:forum-post-1:created",
      }),
    );
  });

  it("does not fail request if emit throws", async () => {
    getViewer.mockResolvedValue({ userId: "user-1", admin: {} });
    getVisibleSpaces.mockResolvedValue([
      { id: "space-1", slug: "general", name: "General" },
    ]);
    canWriteSpace.mockReturnValue(true);
    emitPortalEvent.mockRejectedValue(new Error("emit failed"));

    const { POST } = await import("./route");
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        space_slug: "general",
        title: "First Post",
        body_md: "hello",
      }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      post: expect.objectContaining({ id: "forum-post-1" }),
    });
  });
});
