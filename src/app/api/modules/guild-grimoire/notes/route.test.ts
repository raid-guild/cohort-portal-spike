import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuth = vi.fn();
const emitPortalEvent = vi.fn();

vi.mock("@/app/api/modules/guild-grimoire/lib", () => ({
  requireAuth,
  asString: (value: unknown) => (typeof value === "string" ? value.trim() : ""),
  asStringArray: (value: unknown) =>
    Array.isArray(value) ? value.filter((item) => typeof item === "string") : [],
  jsonError: (message: string, status = 400) => Response.json({ error: message }, { status }),
}));

vi.mock("@/app/api/modules/guild-grimoire/transcription", () => ({
  canEnqueueTranscription: () => false,
  enqueueTranscriptionJob: vi.fn(),
}));

vi.mock("@/lib/portal-events", () => ({
  emitPortalEvent,
}));

describe("guild-grimoire notes create route", () => {
  beforeEach(() => {
    requireAuth.mockReset();
    emitPortalEvent.mockReset();
  });

  it("emits note_created event for text notes and preserves response shape", async () => {
    requireAuth.mockResolvedValue({
      userId: "user-1",
      admin: {
        from: (table: string) => {
          if (table === "guild_grimoire_notes") {
            const chain = {
              insert: () => chain,
              select: () => chain,
              single: vi.fn().mockResolvedValue({
                data: { id: "note-1" },
                error: null,
              }),
            };
            return chain;
          }
          const chain = {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
          return chain;
        },
      },
    });
    emitPortalEvent.mockResolvedValue({ ok: true });

    const { POST } = await import("./route");
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content_type: "text",
        text_content: "hello grimoire",
        visibility: "shared",
        tag_ids: [],
      }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "note-1" });
    expect(emitPortalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleId: "guild-grimoire",
        kind: "core.guild_grimoire.note_created",
        dedupeKey: "guild_grimoire_note:note-1:created",
      }),
    );
  });

  it("does not fail text note request if emit throws", async () => {
    requireAuth.mockResolvedValue({
      userId: "user-1",
      admin: {
        from: () => {
          const chain = {
            insert: () => chain,
            select: () => chain,
            single: vi.fn().mockResolvedValue({
              data: { id: "note-1" },
              error: null,
            }),
          };
          return chain;
        },
      },
    });
    emitPortalEvent.mockRejectedValue(new Error("emit failed"));

    const { POST } = await import("./route");
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content_type: "text",
        text_content: "hello grimoire",
        visibility: "private",
        tag_ids: [],
      }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "note-1" });
  });
});
