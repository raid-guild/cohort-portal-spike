import { beforeEach, describe, expect, it, vi } from "vitest";

const requireViewer = vi.fn();
const loadPostById = vi.fn();
const emitPortalEvent = vi.fn();

vi.mock("@/app/api/modules/dao-blog/lib", () => ({
  asUntypedAdmin: () => ({
    from: () => {
      const chain = {
        update: () => chain,
        eq: () => chain,
        select: () => chain,
        single: vi.fn().mockResolvedValue({
          data: {
            id: "post-1",
            slug: "hello-world",
            title: "Hello World",
            published_at: "2026-02-27T00:00:00.000Z",
          },
          error: null,
        }),
      };
      return chain;
    },
  }),
  isHostRole: (roles: string[]) => roles.includes("host"),
  jsonError: (message: string, status = 400) => Response.json({ error: message }, { status }),
  loadPostById,
  requireViewer,
}));

vi.mock("@/lib/portal-events", () => ({
  emitPortalEvent,
}));

describe("dao-blog approve route", () => {
  beforeEach(() => {
    requireViewer.mockReset();
    loadPostById.mockReset();
    emitPortalEvent.mockReset();
  });

  it("emits post_published event and preserves response shape", async () => {
    requireViewer.mockResolvedValue({
      userId: "host-1",
      roles: ["host"],
      admin: {},
    });
    loadPostById.mockResolvedValue({
      id: "post-1",
      status: "in_review",
      summary: "Summary",
      header_image_url: "https://cdn.example/header.webp",
      deleted_at: null,
    });
    emitPortalEvent.mockResolvedValue({ ok: true });

    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost") as never, {
      params: Promise.resolve({ id: "post-1" }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      post: expect.objectContaining({
        id: "post-1",
        slug: "hello-world",
      }),
    });
    expect(emitPortalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleId: "dao-blog",
        kind: "core.dao_blog.post_published",
        dedupeKey: "dao_blog_post:post-1:published",
      }),
    );
  });

  it("does not fail request if emit throws", async () => {
    requireViewer.mockResolvedValue({
      userId: "host-1",
      roles: ["host"],
      admin: {},
    });
    loadPostById.mockResolvedValue({
      id: "post-1",
      status: "in_review",
      summary: "Summary",
      header_image_url: "https://cdn.example/header.webp",
      deleted_at: null,
    });
    emitPortalEvent.mockRejectedValue(new Error("emit failed"));

    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost") as never, {
      params: Promise.resolve({ id: "post-1" }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      post: expect.objectContaining({ id: "post-1" }),
    });
  });
});
